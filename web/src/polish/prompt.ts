import type { FoundComponent, Locale } from "../panels.ts";
import { TOKENS_FILE } from "../panels.ts";
import { COMPONENT_VARIANTS, KIND_NAMES, KIND_STATES } from "./components.ts";
import type { MotionEffect } from "./motion.ts";
import { formatParam } from "./params.ts";
import { defaults, type ParamValues } from "./types.ts";

// 交给 AI 的结构化需求：页面上哪类组件、在哪（选择器）、现在什么样（计算样式）、要改成什么样、状态要求、不要什么。

const WORDS = {
	zh: {
		component: (kind: string, count: number, variant: string) => `把页面里的「${kind}」（共 ${count} 个）改成「${variant}」做法`,
		motion: (kind: string, count: number, effect: string) => `给页面里的「${kind}」（共 ${count} 个）加上「${effect}」动效`,
		where: (group: string, one: string, text: string) => `位置：同类全部 \`${group}\`；代表元素 \`${one}\`${text ? `（“${text}”）` : ""}`,
		current: "现在的样式",
		look: "要的样子",
		params: "参数",
		states: "状态要求",
		rejected: "不要的做法",
		sep: "：",
		rules: `实现要求：改源码里这些组件的样式（不要只加一层覆盖），颜色、圆角、阴影、间距优先用 ${TOKENS_FILE} 里的 --sui-* 设计变量；沿用项目现有技术栈，不新增依赖；用户开启“减弱动态”（prefers-reduced-motion）时去掉位移、缩放和循环动画，只保留淡入淡出或直接切换。`,
	},
	en: {
		component: (kind: string, count: number, variant: string) => `Restyle the ${kind.toLowerCase()} on this page (${count} in total) as “${variant}”`,
		motion: (kind: string, count: number, effect: string) => `Add the “${effect}” motion to the ${kind.toLowerCase()} on this page (${count} in total)`,
		where: (group: string, one: string, text: string) => `Where: all of them \`${group}\`; representative element \`${one}\`${text ? ` (“${text}”)` : ""}`,
		current: "Current styles",
		look: "Wanted look",
		params: "Parameters",
		states: "States to cover",
		rejected: "Variants not wanted",
		sep: ": ",
		rules: `Implementation: change these components' styles in the source (don't just add an override layer), preferring the --sui-* design variables in ${TOKENS_FILE} for colors, radii, shadows and spacing; keep the project's existing stack, add no dependencies; when the user prefers reduced motion (prefers-reduced-motion), drop movement, scaling and looping animation and keep only fades or instant changes.`,
	},
};

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function head(found: FoundComponent, locale: Locale) {
	const w = WORDS[locale];
	const styles = Object.entries(found.styles)
		.filter(([, value]) => value)
		.map(([key, value]) => `${kebab(key)}: ${value}`)
		.join("; ");
	return [w.where(found.groupSelector, found.selector, found.text), ...(styles ? [`${w.current}${w.sep}${styles}`] : [])];
}

export function componentRequest({ found, variant, reasons, locale }: { found: FoundComponent; variant: string; reasons: Record<string, string>; locale: Locale }) {
	const w = WORDS[locale];
	const variants = COMPONENT_VARIANTS[found.kind] ?? [];
	const chosen = variants.find((v) => v.id === variant)!;
	const others = variants.filter((v) => v.id !== variant);
	const lines = [w.component(KIND_NAMES[found.kind][locale], found.count, chosen.name[locale]), "", ...head(found, locale)];
	lines.push(`${w.look}${w.sep}${chosen.look[locale]}`, `${w.states}${w.sep}${KIND_STATES[found.kind][locale]}`);
	lines.push(`${w.rejected}${w.sep}`, ...others.map((v) => `- ${v.name[locale]}${reasons[v.id]?.trim() ? `${w.sep}${reasons[v.id]!.trim()}` : ""}`));
	lines.push(w.rules);
	return lines.join("\n");
}

export function motionRequest({ found, effect, params, locale }: { found: FoundComponent; effect: MotionEffect; params: ParamValues; locale: Locale }) {
	const w = WORDS[locale];
	const p = { ...defaults(effect.params), ...params };
	const lines = [w.motion(KIND_NAMES[found.kind][locale], found.count, effect.name[locale]), "", ...head(found, locale)];
	lines.push(`${w.params}${w.sep}`, ...effect.params.map((spec) => `- ${spec.label[locale]}${w.sep}${formatParam(spec, p[spec.key]!, locale)}`));
	lines.push(`${w.look}${w.sep}${effect.describe(p)[locale]}`, `${w.states}${w.sep}${effect.states[locale]}`, w.rules);
	return lines.join("\n");
}
