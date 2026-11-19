import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { type AgentSession, type AgentSessionEvent, type ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { type CircledElement, renderAnnotation } from "./annotate.ts";
import {
	conversationsDir,
	createAgent,
	DEFAULT_SESSIONS_DIR,
	listConversations,
	recordDisplayText,
	toolSummary,
	transcriptOf,
} from "./conversations.ts";
import { discoverPages } from "./project-discovery.ts";
import { captureProjectPage } from "./project-page-shot.ts";
import { DevServer, hasDevScript } from "./dev-server.ts";
import { assertUsable, isUsable, type Model, modelKey } from "./models.ts";
import { type PreviewProxy, startPreviewProxy } from "./preview-proxy.ts";
import { type Annotation, type ConversationInfo, type ExclusiveTask, IMAGE_MIME_TYPES, type ImageAttachment, type SessionEvent, type Viewport } from "./protocol.ts";

type PreviewEvent = Extract<SessionEvent, { type: "preview" }>;
type Listener = (event: SessionEvent) => void;

export type OpenOptions = {
	dir: string;
	modelRuntime: ModelRuntime;
	model: Model;
	/** 工作台页面的来源；只有它们能向预览查询页面状态。 */
	appOrigins?: string[];
	/** 对话记录的根目录，每个项目在其下有自己的子目录。默认在 s-ui 自己的目录里。 */
	sessionsDir?: string;
};

const TASK_NAMES: Record<ExclusiveTask, string> = { organizing: "organizing design settings", savingTokens: "saving design settings" };

/** 独占任务进行中时的拒绝：code 供界面翻译，message 供日志与无翻译时显示。 */
function busy(task: ExclusiveTask, advice: string) {
	return Object.assign(new Error(`Busy ${TASK_NAMES[task]}; ${advice}`), { code: `busy:${task}` });
}

const CHAT_EVENTS = new Set<SessionEvent["type"]>(["user", "assistant_delta", "assistant_end", "tool", "error"]);

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

/**
 * 一个项目文件夹的会话：拥有该项目的对话（pi 持久化会话，可新建、切换）和 dev server 进程的完整生命周期。
 * 外界只通过 prompt / setModel / newConversation / switchConversation / subscribe / abort / dispose 与它交互。
 */
export class ProjectSession {
	readonly dir: string;
	#modelRuntime: ModelRuntime;
	#conversationsDir: string;
	#agent!: AgentSession;
	#offAgent?: () => void;
	/** 当前对话在界面上的内容，订阅时重放；连续的文字增量合并成一条。 */
	#transcript: SessionEvent[] = [];
	#conversations: (ConversationInfo & { path: string })[] = [];
	/** 所有要用到当前 pi 会话的操作（发消息、换模型、新建/切换对话）排队执行，避免用到正被替换的会话。 */
	#queue: Promise<unknown> = Promise.resolve();
	/** 正在独占改项目文件的任务（如整理设计变量）；期间对话消息会被拒绝，避免两边同时改文件。 */
	#exclusive?: ExclusiveTask;
	#dev: DevServer;
	#appOrigins: string[];
	#proxy?: PreviewProxy;
	#listeners = new Set<Listener>();
	#preview: PreviewEvent = { type: "preview", state: "starting" };
	#starting?: Promise<void>;
	#disposed = false;

	private constructor(options: OpenOptions) {
		this.dir = options.dir;
		this.#modelRuntime = options.modelRuntime;
		this.#conversationsDir = conversationsDir(options.sessionsDir ?? DEFAULT_SESSIONS_DIR, options.dir);
		this.#appOrigins = options.appOrigins ?? [];
		this.#dev = new DevServer(options.dir);
	}

	/** 打开项目：接着上次最近的对话，没有就新开一个。 */
	static async open(options: OpenOptions) {
		assertUsable(options.modelRuntime, options.model);
		await mkdir(options.dir, { recursive: true });
		const session = new ProjectSession(options);
		const recent = (await listConversations(options.dir, session.#conversationsDir))[0];
		const sessionManager = recent ? SessionManager.open(recent.path, session.#conversationsDir) : session.#newSessionManager();
		await session.#attach(await session.#createAgent(sessionManager, options.model));
		session.#ensurePreview();
		return session;
	}

	get model() {
		return this.#agent.model as Model;
	}

	/** 预览页面地址（经预览代理）；页面没跑起来时为空。 */
	get previewUrl() {
		return this.#preview.state === "ready" ? this.#preview.url : undefined;
	}

	#pageUrl(path: string) {
		if (!this.#proxy || this.#preview.state !== "ready" || !this.#preview.pages?.includes(path)) throw new Error("Unknown preview page");
		return new URL(path, this.#proxy.url).href;
	}

	selectPage(path: string) {
		const url = this.#pageUrl(path);
		this.#emit({ ...this.#preview, url, selectedPage: path });
	}

	capturePage(path: string) {
		return captureProjectPage(this.#pageUrl(path));
	}

	/** 订阅事件；订阅时先重放当前对话、对话列表、模型、预览和运行状态。 */
	subscribe(listener: Listener) {
		this.#listeners.add(listener);
		for (const event of this.#snapshot()) listener(event);
		listener(this.#preview);
		if (this.#agent.isStreaming) listener({ type: "busy", busy: true });
		return () => {
			this.#listeners.delete(listener);
		};
	}

	/** 发一条消息，可附图片；带圈注时先渲染圈注截图并找出圈内元素。失败以 error 事件报告。 */
	async prompt(text: string, { annotation, images = [] }: { annotation?: Annotation; images?: ImageAttachment[] } = {}) {
		try {
			for (const image of images) {
				if (!IMAGE_MIME_TYPES.includes(image.mimeType)) throw new Error(`Unsupported image type: ${image.mimeType}`);
			}
			// 渲染圈注较慢，在排队之外做；排队只覆盖“记入当前对话并交给 pi”这一步。
			const { fullText, image } = await this.#withAnnotation(text, annotation);
			const all = [...(image ? [{ data: image, mimeType: "image/png" as const }] : []), ...images];
			await this.#serialized(() => {
				if (this.#exclusive) throw busy(this.#exclusive, "send your message when it finishes");
				this.#emit({ type: "user", text, images: all.map((i) => `data:${i.mimeType};base64,${i.data}`) });
				recordDisplayText(this.#agent, text);
				return this.#dispatch(fullText, all);
			});
		} catch (error) {
			this.#emit({ type: "error", message: (error as Error).message, code: (error as NodeJS.ErrnoException).code });
		}
	}

	/**
	 * 独占项目文件执行一个任务（如整理设计变量）：对话 AI 正在工作或已有独占任务时拒绝；
	 * 执行期间对话消息被拒绝，任务的改动因此只来自它自己。
	 */
	async runExclusive<T>(task: ExclusiveTask, fn: () => Promise<T>) {
		await this.#serialized(async () => {
			if (this.#exclusive) throw busy(this.#exclusive, "try again when it finishes");
			if (this.#agent.isStreaming) throw Object.assign(new Error("The AI is working on the project; try again when it finishes"), { code: "busy:ai" });
			this.#exclusive = task;
			this.#emit({ type: "exclusive", task });
		});
		try {
			return await fn();
		} finally {
			this.#exclusive = undefined;
			this.#emit({ type: "exclusive" });
		}
	}

	/** 换模型：当前对话从下一条消息起使用它，并记进对话记录。 */
	async setModel(model: Model) {
		assertUsable(this.#modelRuntime, model);
		await this.#serialized(async () => {
			await this.#agent.setModel(model);
			this.#emit({ type: "model", model: modelKey(model) });
		});
	}

	/** 开一个空的新对话；旧对话保留在列表里。 */
	newConversation() {
		return this.#replaceConversation(() => this.#newSessionManager());
	}

	switchConversation(id: string) {
		return this.#replaceConversation(() => {
			const target = this.#conversations.find((c) => c.id === id);
			if (!target) throw new Error(`Unknown conversation: ${id}`);
			return SessionManager.open(target.path, this.#conversationsDir);
		});
	}

	abort() {
		return this.#agent.abort();
	}

	/** 释放会话、停掉 dev server 与预览代理；可重复调用。 */
	async dispose() {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#listeners.clear();
		await this.#queue;
		await this.#agent.abort();
		this.#offAgent?.();
		this.#agent.dispose();
		await this.#starting;
		await this.#dev.stop();
		await this.#proxy?.close();
	}

	#newSessionManager() {
		return SessionManager.create(this.dir, this.#conversationsDir);
	}

	/**
	 * 排队执行一个操作。失败只让这次调用失败，队列本身继续，之后的操作和 dispose 照常进行。
	 */
	#serialized<T>(operation: () => Promise<T>) {
		const run = this.#queue.then(operation);
		this.#queue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	/** 交给 pi，pi 接收后即返回（不等这一轮跑完）；之后的失败以 error 事件报告。 */
	#dispatch(fullText: string, images: ImageAttachment[]) {
		const agent = this.#agent;
		return new Promise<void>((resolve, reject) => {
			let accepted = false;
			agent
				.prompt(fullText, {
					images: images.length ? images.map((i) => ({ type: "image" as const, ...i })) : undefined,
					streamingBehavior: agent.isStreaming ? "followUp" : undefined,
					preflightResult: () => {
						accepted = true;
						resolve();
					},
				})
				.then(resolve, (error: Error) => (accepted ? this.#emit({ type: "error", message: error.message }) : reject(error)));
		});
	}

	/** 为对话创建 pi 会话：新对话用 fallbackModel；旧对话沿用记录里的模型，除非它已不可用。 */
	async #createAgent(sessionManager: SessionManager, fallbackModel: Model) {
		const restored = sessionManager.getEntryCount() > 0;
		const agent = await createAgent({ dir: this.dir, modelRuntime: this.#modelRuntime, sessionManager, model: restored ? undefined : fallbackModel });
		if (!agent.model || !isUsable(this.#modelRuntime, agent.model as Model)) await agent.setModel(fallbackModel);
		return agent;
	}

	async #attach(agent: AgentSession) {
		this.#agent = agent;
		this.#offAgent = agent.subscribe((e) => this.#onAgentEvent(e));
		this.#transcript = transcriptOf(agent);
		this.#conversations = await listConversations(this.dir, this.#conversationsDir);
	}

	/** 换到另一个对话：先确认目标、建好新会话，再停掉并释放旧会话，任一步失败都保留原对话。 */
	#replaceConversation(next: () => SessionManager) {
		return this.#serialized(async () => {
			const old = this.#agent;
			const agent = await this.#createAgent(next(), this.model);
			await old.abort();
			this.#offAgent?.();
			await this.#attach(agent);
			old.dispose();
			for (const event of this.#snapshot()) this.#broadcast(event);
		});
	}

	#snapshot(): SessionEvent[] {
		return [
			{ type: "conversation", id: this.#agent.sessionId },
			...this.#transcript,
			{ type: "conversations", list: this.#conversations.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })) },
			{ type: "model", model: modelKey(this.model) },
			...(this.#exclusive ? [{ type: "exclusive" as const, task: this.#exclusive }] : []),
		];
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
		if (CHAT_EVENTS.has(event.type)) this.#record(event);
		this.#broadcast(event);
	}

	#broadcast(event: SessionEvent) {
		for (const listener of this.#listeners) listener(event);
	}

	#record(event: SessionEvent) {
		const last = this.#transcript.at(-1);
		if (event.type === "assistant_delta" && last?.type === "assistant_delta") {
			this.#transcript[this.#transcript.length - 1] = { ...last, text: last.text + event.text };
		} else {
			this.#transcript.push(event);
		}
	}

	/** 一轮结束：先刷新对话列表（新对话此时才落盘、才有名字），再报告空闲。 */
	async #onSettled() {
		try {
			this.#conversations = await listConversations(this.dir, this.#conversationsDir);
			this.#broadcast({ type: "conversations", list: this.#conversations.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })) });
		} catch (error) {
			this.#emit({ type: "error", message: (error as Error).message });
		} finally {
			this.#emit({ type: "busy", busy: false });
			this.#ensurePreview();
		}
	}

	#onAgentEvent(e: AgentSessionEvent) {
		if (e.type === "agent_start") return this.#emit({ type: "busy", busy: true });
		// 空文件夹里 AI 刚建好项目，或 dev server 之前没起来：结束时会再试一次。
		if (e.type === "agent_settled") return void this.#onSettled();
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
		try {
			if (!(await hasDevScript(this.dir))) {
				const entries = await readdir(this.dir);
				return this.#emit({ type: "preview", state: entries.length ? "missing" : "empty" });
			}
			if (this.#dev.needsInstall()) {
				this.#emit({ type: "preview", state: "installing" });
				await this.#dev.install();
			}
			if (this.#disposed) return;
			this.#emit({ type: "preview", state: "starting" });
			const devUrl = await this.#dev.start((log) => void this.#onDevExit(log));
			this.#proxy = await startPreviewProxy(devUrl, this.#appOrigins);
			const pages = await discoverPages(this.dir);
			const selectedPage = pages.length === 1 ? pages[0] : undefined;
			this.#emit({ type: "preview", state: "ready", url: selectedPage ? new URL(selectedPage, this.#proxy.url).href : this.#proxy.url, pages, selectedPage });
		} catch (error) {
			this.#emit({ type: "preview", state: "error", message: (error as Error).message });
		}
	}
}
