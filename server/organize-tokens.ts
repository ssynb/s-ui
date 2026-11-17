// 「整理」：一次性 AI 子会话把项目里散落的字体、颜色、圆角、阴影、间距收拢成设计变量，页面外观不变。
// 不进项目对话记录；整理前后对比整页截图，并报告改动过的文件。
import { createHash } from "node:crypto";
import { glob, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AgentSession, type ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { sameAppearance, screenshotPage } from "./appearance.ts";
import { createAgent, toolSummary } from "./conversations.ts";
import { DESIGN_TOKENS, TOKENS_FILE } from "./design-tokens.ts";
import type { Model } from "./models.ts";
import type { OrganizeProgress, OrganizeResult } from "./modules/polish.ts";
import { readTokensStatus } from "./tokens-file.ts";

const IGNORED = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.*/**", "**/.*"];
const MAX_SNAPSHOT_BYTES = 1024 * 1024;

const ORGANIZE_PROMPT = `Organize this project's styling into design tokens WITHOUT changing how any page looks.

1. Create ${TOKENS_FILE} that defines ALL of these CSS custom properties on :root, with values taken from what the project uses today:
${DESIGN_TOKENS.map((t) => `   - ${t.name}: ${t.meaning}`).join("\n")}
   When the project has no value for a token, pick one consistent with the current design (for example derived from existing colors).
2. Make sure ${TOKENS_FILE} is loaded before the project's other styles (import it from the main stylesheet or the entry script).
3. Replace hardcoded values in the project's styles with var(--sui-...) wherever they mean the same thing: font families, the colors above, border radii, box shadows; spacing only where it is an exact multiple of --sui-space (use calc(var(--sui-space) * n)). Computed values must stay identical.
4. If the project loads web fonts, keep them loading; put font stylesheet imports as @import url("...") lines at the top of ${TOKENS_FILE}.
Do not change markup, content or behaviour. Do not start a dev server.
Edit carefully: in minified CSS keep every brace and semicolon balanced; after editing, re-read each changed file to check it is still valid.
Finish with one short sentence describing what you changed.`;

const FIX_PROMPT = `After your changes the page no longer looks the same. The first attached image is the page before, the second is now.
Find what broke (often a missing brace or semicolon, a wrong variable, or a changed value) and fix it so the page looks exactly like before, still using the design tokens. Reply with one short sentence.`;

const UNDONE_SUMMARY = "Organizing changed how the page looks and could not be fixed, so every change was undone.";

type Project = { dir: string; model: Model; previewUrl?: string };
type Progress = (data: OrganizeProgress) => void;

/** 项目源文件的内容快照（相对路径 → 内容），用来找出并在需要时撤销 AI 的改动。 */
async function snapshot(dir: string) {
	const files = new Map<string, Buffer>();
	for await (const file of glob("**/*", { cwd: dir, exclude: IGNORED })) {
		const path = join(dir, file);
		const info = await stat(path);
		if (info.isFile() && info.size <= MAX_SNAPSHOT_BYTES) files.set(file, await readFile(path));
	}
	return files;
}

function changedFiles(before: Map<string, Buffer>, after: Map<string, Buffer>) {
	const files = new Set([...before.keys(), ...after.keys()]);
	return [...files].filter((f) => !before.get(f)?.equals(after.get(f) ?? Buffer.alloc(0)) || !after.has(f)).sort();
}

async function restore(dir: string, before: Map<string, Buffer>, after: Map<string, Buffer>) {
	for (const file of changedFiles(before, after)) {
		const original = before.get(file);
		if (original) await writeFile(join(dir, file), original);
		else await rm(join(dir, file), { force: true });
	}
}

async function ask(agent: AgentSession, text: string, images?: Buffer[]) {
	await agent.prompt(text, { images: images?.map((png) => ({ type: "image" as const, data: png.toString("base64"), mimeType: "image/png" })) });
	const last = agent.messages.findLast((m) => m.role === "assistant");
	if (last?.role === "assistant" && last.stopReason === "error") throw new Error(last.errorMessage ?? "The AI failed to organize the styles");
	return agent.getLastAssistantText() ?? "";
}

/**
 * 整理并核对外观：外观变了先请 AI 对照前后截图修一次；仍不一致就撤销全部改动。
 * 没有预览地址时无法核对，只做整理。
 */
async function organizeAndVerify(project: Project, modelRuntime: ModelRuntime, progress: Progress, before: Map<string, Buffer>) {
	const { dir, model, previewUrl } = project;
	const shotBefore = previewUrl ? await screenshotPage(previewUrl) : undefined;
	const agent = await createAgent({ dir, modelRuntime, model, sessionManager: SessionManager.inMemory(dir) });
	const off = agent.subscribe((e) => {
		if (e.type === "tool_execution_start") progress({ phase: "tool", name: e.toolName, summary: toolSummary(e.args) });
		if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta") progress({ phase: "text", text: e.assistantMessageEvent.delta });
	});
	try {
		progress({ phase: "analyzing" });
		let summary = await ask(agent, ORGANIZE_PROMPT);
		if (!previewUrl || !shotBefore) return { summary, appearanceUnchanged: undefined };

		progress({ phase: "verifying" });
		let shotAfter = await screenshotPage(previewUrl);
		if (await sameAppearance(shotBefore, shotAfter)) return { summary, appearanceUnchanged: true };

		summary = await ask(agent, FIX_PROMPT, [shotBefore, shotAfter]);
		progress({ phase: "verifying" });
		shotAfter = await screenshotPage(previewUrl);
		if (await sameAppearance(shotBefore, shotAfter)) return { summary, appearanceUnchanged: true };

		await restore(dir, before, await snapshot(dir));
		return { summary: UNDONE_SUMMARY, appearanceUnchanged: false };
	} finally {
		off();
		agent.dispose();
	}
}

export async function organizeTokens(project: Project, modelRuntime: ModelRuntime, progress: Progress): Promise<OrganizeResult> {
	const status = await readTokensStatus(project.dir);
	if (status.organized) return { ...status, changedFiles: [], summary: "Design tokens are already organized." };

	const before = await snapshot(project.dir);
	const { summary, appearanceUnchanged } = await organizeAndVerify(project, modelRuntime, progress, before);
	const changed = changedFiles(before, await snapshot(project.dir));
	return { ...(await readTokensStatus(project.dir)), changedFiles: changed, appearanceUnchanged, summary };
}
