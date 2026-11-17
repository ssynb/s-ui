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

/** 换配色后仍是原主色的组件：请 AI 把写死的颜色改用设计变量（外观按已保存的设置不变）。 */
export function leftoverColorsRequest({ components, original, locale }: { components: FoundComponent[]; original: string; locale: Locale }) {
	const zh = locale === "zh";
	const head = zh
		? `页面里还有写死的颜色没用设计设置：下面这些元素仍是原来的主色 ${original}，换配色时不会跟着变。请把它们的颜色改用 ${TOKENS_FILE} 里的设计变量（主色用 --sui-color-primary，主色上的文字用 --sui-color-primary-contrast，边框用 --sui-color-border，其余按含义选），只改颜色的写法，不改布局和其他样式；按现在保存的设置，页面外观应保持不变。`
		: `Some colors on the page are hard-coded instead of using the design settings: the elements below still use the old primary ${original} and don't follow palette changes. Switch their colors to the design variables in ${TOKENS_FILE} (--sui-color-primary for the primary, --sui-color-primary-contrast for text on it, --sui-color-border for borders, others by meaning). Change only how colors are written, not layout or other styles; with the currently saved settings the page should look the same.`;
	const lines = components.map((c) => `- ${KIND_NAMES[c.kind][locale]}${zh ? `（共 ${c.count} 个）：` : ` (${c.count}): `}\`${c.groupSelector}\`${zh ? "，代表元素" : ", e.g."} \`${c.selector}\``);
	return [head, "", ...lines].join("\n");
}

export function motionRequest({ found, effect, params, locale }: { found: FoundComponent; effect: MotionEffect; params: ParamValues; locale: Locale }) {
	const w = WORDS[locale];
	const p = { ...defaults(effect.params), ...params };
	const lines = [w.motion(KIND_NAMES[found.kind][locale], found.count, effect.name[locale]), "", ...head(found, locale)];
	lines.push(`${w.params}${w.sep}`, ...effect.params.map((spec) => `- ${spec.label[locale]}${w.sep}${formatParam(spec, p[spec.key]!, locale)}`));
	lines.push(`${w.look}${w.sep}${effect.describe(p)[locale]}`, `${w.states}${w.sep}${effect.states[locale]}`, w.rules);
	return lines.join("\n");
}
