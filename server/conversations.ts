// 项目对话的存储与还原：每个项目的对话是 pi 持久化会话（JSONL），存在 s-ui 自己目录下；
// 打开时从会话记录重建界面上的对话（含工具调用与图片），AI 也从同一份记录恢复上下文。
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import {
	type AgentSession,
	createAgentSession,
	DefaultResourceLoader,
	type ModelRuntime,
	type SessionEntry,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { APP_HOME } from "./app-home.ts";
import type { Model } from "./models.ts";
import type { ConversationInfo, SessionEvent } from "./protocol.ts";

// 产品自己的 agent 资源目录：不加载用户 ~/.pi/agent 下的扩展、技能、SYSTEM.md 等个人定制。
// 模型凭据仍由传入的 ModelRuntime 决定（默认读 ~/.pi/agent/auth.json）。
const APP_AGENT_DIR = join(APP_HOME, "agent");
export const DEFAULT_SESSIONS_DIR = join(APP_HOME, "sessions");

const DESIGNER_PROMPT = `You are the engine of s-ui, a page design workbench for people who do not write front-end code. The user sees a live preview of this project next to the chat.
- Change the project's real source files directly and keep edits focused on what the user asked.
- The host app installs dependencies and runs the dev server itself. Never start a dev server or any long-running process.
- If the folder has no package.json and the user asks for a page, scaffold a minimal Vite project by writing files: package.json with {"type":"module","scripts":{"dev":"vite"},"devDependencies":{"vite":"^8"}}, index.html, src/main.js and src/style.css. Use plain HTML/CSS/JS unless the user asks for a framework. Do not run interactive scaffolders.
- If you add dependencies to an existing package.json, run the project's package manager install command.
- Reply briefly in the user's language. Do not paste code unless asked.`;

/** 界面上显示的用户原话（发给 AI 的正文可能带圈注说明，与原话不同），记在紧挨用户消息之前。 */
const DISPLAY_TEXT_ENTRY = "s-ui:display-text";
const MAX_LISTED = 10;
const TITLE_CHARS = 60;

/** 一个项目的对话目录：可读的文件夹名加路径哈希，避免同名项目互相覆盖。 */
export function conversationsDir(sessionsRoot: string, projectDir: string) {
	const hash = createHash("sha256").update(projectDir).digest("hex").slice(0, 12);
	return join(sessionsRoot, `${basename(projectDir).replace(/[^\w.-]/g, "_")}-${hash}`);
}

type AgentOptions = { dir: string; modelRuntime: ModelRuntime; sessionManager: SessionManager; model?: Model };

/** 创建 pi 会话；不传 model 时沿用会话记录里保存的模型。 */
export async function createAgent({ dir, modelRuntime, sessionManager, model }: AgentOptions) {
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
		sessionManager,
	});
	return session;
}

/** 最近的对话，最新的在前。只有已经有过回复的对话才会落盘，所以空的新对话不在其中。 */
export async function listConversations(projectDir: string, dir: string): Promise<(ConversationInfo & { path: string })[]> {
	const infos = await SessionManager.list(projectDir, dir);
	return infos
		.sort((a, b) => b.modified.getTime() - a.modified.getTime())
		.slice(0, MAX_LISTED)
		.map((i) => ({ id: i.id, path: i.path, title: i.name ?? i.firstMessage.slice(0, TITLE_CHARS), updatedAt: i.modified.getTime() }));
}

/** 记下用户原话；对话还没有名字时用它命名。 */
export function recordDisplayText(agent: AgentSession, text: string) {
	agent.sessionManager.appendCustomEntry(DISPLAY_TEXT_ENTRY, { text });
	if (!agent.sessionName) agent.setSessionName(text.slice(0, TITLE_CHARS));
}

export function toolSummary(args: Record<string, unknown> | undefined) {
	const value = args?.path ?? args?.command ?? "";
	return String(value).slice(0, 120);
}

type Content = string | ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string } | { type: string })[];

function partsOf(content: Content) {
	return typeof content === "string" ? [{ type: "text" as const, text: content }] : content;
}

function userEvent(content: Content, displayText?: string): SessionEvent {
	const parts = partsOf(content);
	const text = parts.flatMap((p) => (p.type === "text" && "text" in p ? [p.text] : [])).join("\n");
	const images = parts.flatMap((p) => (p.type === "image" && "data" in p ? [`data:${p.mimeType};base64,${p.data}`] : []));
	return { type: "user", text: displayText ?? text, images };
}

/** 从会话记录（当前分支）重建界面上的对话事件。 */
export function transcriptOf(agent: AgentSession): SessionEvent[] {
	const events: SessionEvent[] = [];
	// 原话按顺序对应之后的用户消息（AI 忙时连发的几条也能一一对上）。
	const displayTexts: string[] = [];
	for (const entry of agent.sessionManager.getBranch() as SessionEntry[]) {
		if (entry.type === "custom" && entry.customType === DISPLAY_TEXT_ENTRY) {
			displayTexts.push((entry.data as { text: string }).text);
			continue;
		}
		if (entry.type !== "message") continue;
		const message = entry.message;
		if (message.role === "user") {
			events.push(userEvent(message.content as Content, displayTexts.shift()));
		} else if (message.role === "assistant") {
			for (const part of message.content) {
				if (part.type === "text") events.push({ type: "assistant_delta", text: part.text });
				if (part.type === "toolCall") events.push({ type: "tool", phase: "start", id: part.id, name: part.name, summary: toolSummary(part.arguments) });
			}
			events.push({ type: "assistant_end" });
			if (message.stopReason === "error") events.push({ type: "error", message: message.errorMessage ?? "model error" });
		} else if (message.role === "toolResult") {
			events.push({ type: "tool", phase: "end", id: message.toolCallId, name: message.toolName, summary: "", isError: message.isError });
		}
	}
	return events;
}
