// 「整理」：一次性 AI 子会话把项目里散落的字体、颜色、圆角、阴影、间距收拢成设计变量，页面外观不变。
// 不进项目对话记录；整理前后对比整页截图，并报告改动过的文件。
// 整理用的 AI 只有只读工具和记账的 edit/write：它的每次写入都可追溯，撤销时只撤它自己写的。
import { type AgentSession, type ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { sameAppearance, screenshotPage } from "./appearance.ts";
import { createAgent, toolSummary } from "./conversations.ts";
import { DESIGN_TOKENS, TOKENS_FILE } from "./design-tokens.ts";
import type { Model } from "./models.ts";
import type { OrganizeProgress, OrganizeResult } from "./modules/polish.ts";
import { readTokensStatus } from "./tokens-file.ts";
import { WriteLedger } from "./write-ledger.ts";

const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"];

const ORGANIZE_PROMPT = `Organize this project's styling into design tokens WITHOUT changing how any page looks.

1. Create ${TOKENS_FILE} that defines ALL of these CSS custom properties on :root, with values taken from what the project uses today:
${DESIGN_TOKENS.map((t) => `   - ${t.name}: ${t.meaning}`).join("\n")}
   When the project has no value for a token, pick one consistent with the current design (for example derived from existing colors).
2. Make sure ${TOKENS_FILE} is loaded before the project's other styles (import it from the main stylesheet or the entry script).
3. Replace hardcoded values in the project's styles with var(--sui-...) wherever they mean the same thing: font families, the colors above, border radii, box shadows; spacing only where it is an exact multiple of --sui-space (use calc(var(--sui-space) * n)). Computed values must stay identical.
4. If the project loads web fonts, keep them loading; put font stylesheet imports as @import url("...") lines at the top of ${TOKENS_FILE}.
Do not change markup, content or behaviour. You can read and edit files; you cannot run commands.
Edit carefully: in minified CSS keep every brace and semicolon balanced; after editing, re-read each changed file to check it is still valid.
Finish with one short sentence describing what you changed.`;

const FIX_PROMPT = `After your changes the page no longer looks the same. The first attached image is the page before, the second is now.
Find what broke (often a missing brace or semicolon, a wrong variable, or a changed value) and fix it so the page looks exactly like before, still using the design tokens. Reply with one short sentence.`;

const UNDONE_SUMMARY = "Organizing changed how the page looks and could not be fixed, so its changes were undone.";
const keptNote = (kept: string[]) => (kept.length ? ` Files changed by someone else meanwhile were left as they are: ${kept.join(", ")}.` : "");

type Project = { dir: string; model: Model; previewUrl?: string; exclusive: <T>(task: string, fn: () => Promise<T>) => Promise<T> };
type Progress = (data: OrganizeProgress) => void;

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
async function organizeAndVerify(project: Project, modelRuntime: ModelRuntime, progress: Progress, ledger: WriteLedger) {
	const { dir, model, previewUrl } = project;
	const shotBefore = previewUrl ? await screenshotPage(previewUrl) : undefined;
	const agent = await createAgent({
		dir,
		modelRuntime,
		model,
		sessionManager: SessionManager.inMemory(dir),
		tools: [...READ_ONLY_TOOLS, "edit", "write"],
		customTools: ledger.tools(),
	});
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

		return { summary: UNDONE_SUMMARY + keptNote(await ledger.undo()), appearanceUnchanged: false };
	} finally {
		off();
		agent.dispose();
	}
}

/**
 * 整理设计变量。独占执行（对话 AI 不会同时改文件）；撤销按写入记账进行，只撤整理自己写的、此刻未被别人再改的文件。
 * 中途任何失败都先撤销整理的写入再报错。
 */
export function organizeTokens(project: Project, modelRuntime: ModelRuntime, progress: Progress): Promise<OrganizeResult> {
	return project.exclusive("organizing design tokens", async () => {
		const status = await readTokensStatus(project.dir);
		if (status.organized) return { ...status, changedFiles: [], summary: "Design tokens are already organized." };

		const ledger = new WriteLedger(project.dir);
		try {
			const { summary, appearanceUnchanged } = await organizeAndVerify(project, modelRuntime, progress, ledger);
			return { ...(await readTokensStatus(project.dir)), changedFiles: await ledger.changedFiles(), appearanceUnchanged, summary };
		} catch (error) {
			const kept = await ledger.undo();
			if (kept.length) (error as Error).message += keptNote(kept);
			throw error;
		}
	});
}
