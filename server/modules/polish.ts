// 「打磨」工具窗的后台模块：设计变量的状态、AI 整理、确定性写回。
// 契约（冻结）：PolishApi 与这里导出的类型。
import type { TokenName, TokenValues } from "../design-tokens.ts";
import { defineModule, type ModuleContext } from "../module-kit.ts";
import { organizeTokens } from "../organize-tokens.ts";
import { readTokensStatus, saveTokens } from "../tokens-file.ts";

export type PolishStatus = {
	/** 项目里已有设计变量文件（TOKENS_FILE），且约定的变量都已定义。 */
	organized: boolean;
	/** 设计变量文件相对项目根的路径（即 TOKENS_FILE）。 */
	file: string;
	/** 文件里当前的变量值（源码里的值，不含预览里未保存的临时样式层）。 */
	values: TokenValues;
	/** 约定里有、文件里还没有定义的变量。 */
	missing: TokenName[];
	/** 文件顶部引入的网页字体样式表（@import url(...)）。 */
	fontImports: string[];
};

/** organize 运行中经 onProgress 推送的进度。 */
export type OrganizeProgress =
	| { phase: "analyzing" }
	| { phase: "tool"; name: string; summary: string }
	| { phase: "verifying" }
	| { phase: "text"; text: string };

export type OrganizeResult = PolishStatus & {
	/** AI 改动过的文件（相对项目根）。 */
	changedFiles: string[];
	/** 整理前后首屏截图对比是否一致（外观不变的检查）；无法比较时为空。 */
	appearanceUnchanged?: boolean;
	/** AI 的简短说明。 */
	summary: string;
};

export type PolishApi = {
	/** 读设计变量文件的状态与当前值。 */
	status: { payload: Record<string, never>; result: PolishStatus };
	/** 让 AI（一次性子会话，不进对话记录）把散落的样式收拢成设计变量，外观不变；需要当前项目。已整理过时直接返回状态。 */
	organize: { payload: Record<string, never>; result: OrganizeResult };
	/**
	 * 确定性写回（不经 AI）：把给出的变量值写进设计变量文件的 :root（只改给出的变量，其余原样），
	 * fontImports 给出时整体替换文件顶部的 @import url(...) 字体行。未整理时失败。
	 */
	saveTokens: { payload: { values: TokenValues; fontImports?: string[] }; result: PolishStatus };
};

function projectOf(ctx: ModuleContext) {
	if (!ctx.project) throw new Error("Open a project first");
	return ctx.project;
}

export const polishModule = defineModule<PolishApi>({
	status: async (_payload, ctx) => readTokensStatus(projectOf(ctx).dir),
	organize: async (_payload, ctx) => organizeTokens(projectOf(ctx), ctx.modelRuntime, ctx.progress),
	saveTokens: async ({ values, fontImports }, ctx) => {
		const project = projectOf(ctx);
		return project.exclusive("saving design tokens", () => saveTokens(project.dir, values, fontImports));
	},
});
