import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type AgentSession,
	type AgentSessionEvent,
	createAgentSession,
	DefaultResourceLoader,
	type ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { type CircledElement, renderAnnotation } from "./annotate.ts";
import { DevServer, hasDevScript } from "./dev-server.ts";
import { assertUsable, type Model } from "./models.ts";
import { type PreviewProxy, startPreviewProxy } from "./preview-proxy.ts";
import type { Annotation, SessionEvent, Viewport } from "./protocol.ts";

// 产品自己的 agent 资源目录：不加载用户 ~/.pi/agent 下的扩展、技能、SYSTEM.md 等个人定制。
// 模型凭据仍由传入的 ModelRuntime 决定（默认读 ~/.pi/agent/auth.json）。
const APP_AGENT_DIR = join(homedir(), ".s-ui", "agent");

const DESIGNER_PROMPT = `You are the engine of s-ui, a page design workbench for people who do not write front-end code. The user sees a live preview of this project next to the chat.
- Change the project's real source files directly and keep edits focused on what the user asked.
- The host app installs dependencies and runs the dev server itself. Never start a dev server or any long-running process.
- If the folder has no package.json and the user asks for a page, scaffold a minimal Vite project by writing files: package.json with {"type":"module","scripts":{"dev":"vite"},"devDependencies":{"vite":"^8"}}, index.html, src/main.js and src/style.css. Use plain HTML/CSS/JS unless the user asks for a framework. Do not run interactive scaffolders.
- If you add dependencies to an existing package.json, run the project's package manager install command.
- Reply briefly in the user's language. Do not paste code unless asked.`;

type PreviewEvent = Extract<SessionEvent, { type: "preview" }>;
type Listener = (event: SessionEvent) => void;

export type OpenOptions = {
	dir: string;
	modelRuntime: ModelRuntime;
	model: Model;
	/** 工作台页面的来源；只有它们能向预览查询页面状态。 */
	appOrigins?: string[];
};

async function createAgent({ dir, modelRuntime, model }: OpenOptions) {
	const settingsManager = SettingsManager.inMemory({});
	const resourceLoader = new DefaultResourceLoader({
		cwd: dir,
		agentDir: APP_AGENT_DIR,
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		appendSystemPrompt: [DESIGNER_PROMPT],
	});
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd: dir,
		agentDir: APP_AGENT_DIR,
		modelRuntime,
		model,
		thinkingLevel: "low",
		resourceLoader,
		settingsManager,
		sessionManager: SessionManager.inMemory(dir),
	});
	return session;
}

function describeElements(elements: CircledElement[]) {
	return elements
		.map((e, i) => [`${i + 1}. selector: ${e.selector}`, `   source: ${e.sources.join(", ") || "unknown"}`, `   html: ${e.html}`].join("\n"))
		.join("\n");
}

function annotationPrompt(text: string, elements: CircledElement[], viewport: Viewport) {
	return `The user circled an area of the page preview (red outline in the attached screenshot, viewport ${viewport.width}x${viewport.height}) and said:
"${text}"

Elements inside the circle:
${describeElements(elements) || "(none detected)"}

Change the project's source code to fulfil the request.`;
}

function toolSummary(args: Record<string, unknown> | undefined) {
	const value = args?.path ?? args?.command ?? "";
	return String(value).slice(0, 120);
}

/**
 * 一个项目文件夹的会话：拥有一个 pi 会话和该项目 dev server 进程的完整生命周期。
 * 外界只通过 prompt / subscribe / dispose 与它交互。
 */
export class ProjectSession {
	readonly dir: string;
	#agent: AgentSession;
	#dev: DevServer;
	#appOrigins: string[];
	#proxy?: PreviewProxy;
	#listeners = new Set<Listener>();
	#preview: PreviewEvent = { type: "preview", state: "starting" };
	#starting?: Promise<void>;
	#disposed = false;

	private constructor(dir: string, agent: AgentSession, appOrigins: string[]) {
		this.dir = dir;
		this.#appOrigins = appOrigins;
		this.#agent = agent;
		this.#dev = new DevServer(dir);
		agent.subscribe((e) => this.#onAgentEvent(e));
	}

	static async open(options: OpenOptions) {
		assertUsable(options.modelRuntime, options.model);
		await mkdir(options.dir, { recursive: true });
		const session = new ProjectSession(options.dir, await createAgent(options), options.appOrigins ?? []);
		session.#ensurePreview();
		return session;
	}

	/** 订阅事件；订阅时立即收到当前预览状态。 */
	subscribe(listener: Listener) {
		this.#listeners.add(listener);
		listener(this.#preview);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	/** 发一条消息；带圈注时先截图并找出圈内元素。失败以 error 事件报告。 */
	async prompt(text: string, annotation?: Annotation) {
		try {
			const { fullText, image } = await this.#withAnnotation(text, annotation);
			this.#emit({ type: "user", text, image: image && `data:image/png;base64,${image}` });
			await this.#agent.prompt(fullText, {
				images: image ? [{ type: "image", data: image, mimeType: "image/png" }] : undefined,
				streamingBehavior: this.#agent.isStreaming ? "followUp" : undefined,
			});
		} catch (error) {
			this.#emit({ type: "error", message: (error as Error).message });
		}
	}

	abort() {
		return this.#agent.abort();
	}

	async dispose() {
		this.#disposed = true;
		this.#listeners.clear();
		await this.#agent.abort();
		this.#agent.dispose();
		await this.#starting;
		await this.#dev.stop();
		await this.#proxy?.close();
	}

	async #withAnnotation(text: string, annotation?: Annotation) {
		if (!annotation) return { fullText: text };
		if (this.#preview.state !== "ready" || !this.#preview.url) throw new Error("Preview is not running");
		const { href } = annotation.capture;
		if (new URL(href).origin !== new URL(this.#preview.url).origin) throw new Error(`Annotation page is not the preview: ${href}`);
		const result = await renderAnnotation({ ...annotation, projectDir: this.dir });
		return { fullText: annotationPrompt(text, result.elements, annotation.viewport), image: result.png.toString("base64") };
	}

	#emit(event: SessionEvent) {
		if (event.type === "preview") this.#preview = event;
		for (const listener of this.#listeners) listener(event);
	}

	#onAgentEvent(e: AgentSessionEvent) {
		if (e.type === "agent_start") return this.#emit({ type: "busy", busy: true });
		if (e.type === "agent_settled") {
			this.#emit({ type: "busy", busy: false });
			// 空文件夹里 AI 刚建好项目，或 dev server 之前没起来：现在再试一次。
			return this.#ensurePreview();
		}
		if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta") {
			return this.#emit({ type: "assistant_delta", text: e.assistantMessageEvent.delta });
		}
		if (e.type === "message_end" && e.message.role === "assistant") {
			if (e.message.stopReason === "error") this.#emit({ type: "error", message: e.message.errorMessage ?? "model error" });
			return this.#emit({ type: "assistant_end" });
		}
		if (e.type === "tool_execution_start") {
			return this.#emit({ type: "tool", phase: "start", id: e.toolCallId, name: e.toolName, summary: toolSummary(e.args) });
		}
		if (e.type === "tool_execution_end") {
			return this.#emit({ type: "tool", phase: "end", id: e.toolCallId, name: e.toolName, summary: "", isError: e.isError });
		}
	}

	#ensurePreview() {
		const running = ["ready", "installing"].includes(this.#preview.state);
		if (this.#disposed || this.#starting || running) return;
		this.#starting = this.#startPreview().finally(() => {
			this.#starting = undefined;
		});
	}

	async #onDevExit(log: string) {
		await this.#proxy?.close();
		this.#proxy = undefined;
		this.#emit({ type: "preview", state: "stopped", message: log });
	}

	async #startPreview() {
		if (!(await hasDevScript(this.dir))) return this.#emit({ type: "preview", state: "empty" });
		try {
			if (this.#dev.needsInstall()) {
				this.#emit({ type: "preview", state: "installing" });
				await this.#dev.install();
			}
			if (this.#disposed) return;
			this.#emit({ type: "preview", state: "starting" });
			const devUrl = await this.#dev.start((log) => void this.#onDevExit(log));
			this.#proxy = await startPreviewProxy(devUrl, this.#appOrigins);
			this.#emit({ type: "preview", state: "ready", url: this.#proxy.url });
		} catch (error) {
			this.#emit({ type: "preview", state: "error", message: (error as Error).message });
		}
	}
}
