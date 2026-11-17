import type { Locale } from "../i18n.ts";
import type { Entry, ParamSpec, ParamValues } from "./types.ts";

export type PromptEntry = Pick<Entry, "name" | "variants" | "params" | "describe" | "states">;

/** 用户在一个条目上的选择：选中的做法、调好的参数、否决其他做法的理由（可空）。 */
export type Choice = { variant: string; params: ParamValues; reasons: Record<string, string> };

/** 作用范围：预览里圈选的元素，或整个页面。 */
export type Target = { kind: "selection"; count: number } | { kind: "page" };

const WORDS = {
	zh: {
		selection: (n: number) => `应用到预览里圈选的 ${n} 个元素（只改它们）`,
		page: "应用到整个页面（找出页面上所有同类元素，统一修改）",
		variant: "做法",
		params: "参数",
		behavior: "行为与动效",
		states: "状态要求",
		rejected: "不要的做法",
		sep: "：",
		rules: "实现要求：沿用项目现有的技术栈、样式写法和设计变量，不新增依赖；用户开启“减弱动态”（prefers-reduced-motion）时去掉位移、缩放和循环动画，只保留淡入淡出或直接切换。",
	},
	en: {
		selection: (n: number) => `Apply to the ${n === 1 ? "circled element" : `${n} circled elements`} in the preview (change only those)`,
		page: "Apply to the whole page (find every element of this kind and change them consistently)",
		variant: "Variant",
		params: "Parameters",
		behavior: "Behavior and motion",
		states: "States to cover",
		rejected: "Variants not wanted",
		sep: ": ",
		rules: "Implementation: keep the project's existing stack, styling approach and design tokens, add no dependencies; when the user prefers reduced motion (prefers-reduced-motion), drop movement, scaling and looping animation and keep only fades or instant changes.",
	},
};

export function formatParam(spec: ParamSpec, value: number | string, locale: Locale): string {
	if (spec.kind === "range") return `${value}${spec.unit}`;
	if (spec.kind === "color") return String(value);
	const option = spec.options.find((o) => o.value === value);
	if (!option) return String(value);
	return spec.showValue ? `${option.label[locale]} ${option.value}` : option.label[locale];
}

/** 交给 AI 的结构化需求，语言跟随界面。 */
export function buildPrompt(entry: PromptEntry, choice: Choice, target: Target, locale: Locale): string {
	const w = WORDS[locale];
	const name = locale === "zh" ? `${entry.name.zh} ${entry.name.en}` : entry.name.en;
	const chosen = entry.variants?.find((v) => v.id === choice.variant);
	const others = entry.variants?.filter((v) => v.id !== choice.variant) ?? [];
	const lines = [`${name} → ${target.kind === "selection" ? w.selection(target.count) : w.page}`, ""];
	if (chosen) lines.push(`${w.variant}${w.sep}${chosen.name[locale]}`);
	if (entry.params.length) {
		lines.push(`${w.params}${w.sep}`);
		for (const spec of entry.params) lines.push(`- ${spec.label[locale]}${w.sep}${formatParam(spec, choice.params[spec.key] ?? spec.default, locale)}`);
	}
	lines.push(`${w.behavior}${w.sep}${entry.describe(choice.params, choice.variant)[locale]}`);
	lines.push(`${w.states}${w.sep}${entry.states[locale]}`);
	if (others.length) {
		lines.push(`${w.rejected}${w.sep}`);
		for (const v of others) {
			const reason = choice.reasons[v.id]?.trim();
			lines.push(`- ${v.name[locale]}${reason ? `${w.sep}${reason}` : ""}`);
		}
	}
	lines.push(w.rules);
	return lines.join("\n");
}
