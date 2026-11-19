import { useEffect, useState } from "react";
import type { ComponentKind, PageInspection, TokenValues } from "../panels.ts";
import { componentLayer } from "./components.ts";
import { type TokenDraft, tokenLayer } from "./draft.ts";
import { FONTS, FONT_ROLES, type FontRole } from "./fonts.ts";
import { MOTION_EFFECTS, motionLayer } from "./motion.ts";
import type { ParamValues } from "./types.ts";

/** 在页面上试着的一种组件做法。 */
export type ComponentTrial = { variant: string; reasons: Record<string, string> };
/** 在页面上试着的一个动效；run 每次重播加一。 */
export type MotionTrial = { effect: string; kind: ComponentKind; params: ParamValues; run: number };

/** 打磨面板里还没保存（或还没交给 AI）的全部改动；页面上看到的临时样式全由它推出。 */
export type PolishDraft = {
	fonts: Partial<Record<FontRole, string>>;
	components: Partial<Record<ComponentKind, ComponentTrial>>;
	motions: MotionTrial[];
};

export const EMPTY_DRAFT: PolishDraft = { fonts: {}, components: {}, motions: [] };

export const motionKey = (t: Pick<MotionTrial, "effect" | "kind">) => `${t.effect}-${t.kind}`;

/** 字体改动对应的设计变量与字体样式表（保存时写进变量文件）。 */
export function tokenDraft(d: PolishDraft): TokenDraft {
	const tokens: TokenValues = {};
	const imports = new Set<string>();
	for (const [role, id] of Object.entries(d.fonts) as [FontRole, string][]) {
		if (role === "ui" && id === "body") tokens[FONT_ROLES.ui] = "var(--sui-font-sans)";
		const font = FONTS.find((f) => f.id === id);
		if (!font) continue;
		tokens[FONT_ROLES[role]] = font.family;
		for (const url of font.urls) imports.add(url);
	}
	return { tokens, fontImports: [...imports] };
}

/** 未保存的改动项数：每类字体、每类组件、每个动效各算一项。 */
export function changeCount(d: PolishDraft) {
	return tokenChangeCount(d) + Object.keys(d.components).length + d.motions.length;
}

export function tokenChangeCount(d: PolishDraft) {
	return Object.keys(d.fonts).length;
}

/**
 * 保存成功后剩下的改动：只清掉保存时发出去、且之后没再动过的字体项；
 * 保存请求进行中又做的修改仍是未保存改动。
 */
export function afterSave(current: PolishDraft, sent: PolishDraft): PolishDraft {
	const next = { ...current, fonts: { ...current.fonts } };
	for (const role of Object.keys(sent.fonts) as FontRole[]) if (next.fonts[role] === sent.fonts[role]) delete next.fonts[role];
	return next;
}

/** 页面上应有的临时样式层（id → CSS）。组件与动效需要识别结果才知道选择器。 */
export function desiredLayers(d: PolishDraft, inspection?: PageInspection) {
	const layers = new Map<string, string>();
	const tokens = tokenLayer(tokenDraft(d).tokens);
	if (tokens) layers.set("polish-tokens", tokens);
	const found = (kind: ComponentKind) => inspection?.components.find((c) => c.kind === kind);
	for (const [kind, trial] of Object.entries(d.components) as [ComponentKind, ComponentTrial][]) {
		const target = found(kind);
		if (target) layers.set(`polish-component-${kind}`, componentLayer(target, trial.variant));
	}
	for (const trial of d.motions) {
		const target = found(trial.kind);
		const effect = MOTION_EFFECTS.find((e) => e.id === trial.effect);
		if (target && effect) layers.set(`polish-motion-${motionKey(trial)}`, motionLayer(effect, target, trial.params, trial.run));
	}
	return layers;
}

// 未保存的改动按项目记在模块里：切换工具窗、换到别的项目再回来都还在（预览重新就绪时会重新注入）。
const DRAFTS = new Map<string, PolishDraft>();

export function usePolishDraft(projectDir: string) {
	const [draft, setDraft] = useState(() => DRAFTS.get(projectDir) ?? EMPTY_DRAFT);
	useEffect(() => {
		DRAFTS.set(projectDir, draft);
	}, [projectDir, draft]);
	return [draft, setDraft] as const;
}
