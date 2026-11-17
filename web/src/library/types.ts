import type { ComponentType } from "react";
import type { Locale } from "../i18n.ts";

/** 条目自带的双语文案（条目文案跟条目放在一起，便于一处扩充）。 */
export type Text = { zh: string; en: string };

type ParamBase = { key: string; label: Text };

export type RangeParam = ParamBase & { kind: "range"; min: number; max: number; step: number; unit: string; default: number };
export type SelectParam = ParamBase & {
	kind: "select";
	options: { value: string; label: Text }[];
	default: string;
	/** 交给 AI 时连同取值一起写出（如缓动曲线的 cubic-bezier）。 */
	showValue?: boolean;
};
export type ColorParam = ParamBase & { kind: "color"; default: string };
export type ParamSpec = RangeParam | SelectParam | ColorParam;

export type ParamValues = Record<string, number | string>;

export type Variant = { id: string; name: Text };

export type DemoProps = {
	p: ParamValues;
	/** 当前渲染的做法（产品组件并排比较时每种做法各渲染一份）。 */
	variant: string;
	/** 全局放慢倍数，JS 计时的演示（定时器、逐字）要乘上它；CSS 时长统一用 dur()。 */
	slow: number;
	locale: Locale;
};

export type CategoryId =
	| "feedback"
	| "transition"
	| "waiting"
	| "personality"
	| "button"
	| "input"
	| "switch"
	| "tabs"
	| "card"
	| "toast"
	| "empty"
	| "loading";

/** 组件库的一个条目：一个动效或一类产品组件。 */
export type Entry = {
	id: string;
	category: CategoryId;
	name: Text;
	/** 一句话说明它是什么。 */
	summary: Text;
	/** 产品组件的几种做法；动效条目只有一种做法，省略。 */
	variants?: Variant[];
	params: ParamSpec[];
	/** 行为与动效描述，即“怎么跟 AI 说”，随参数实时变化。 */
	describe: (p: ParamValues, variant: string) => Text;
	/** 需要覆盖的状态。 */
	states?: Text;
	Demo: ComponentType<DemoProps>;
	/** 演示区高度（px），默认按有无多种做法取值。 */
	stageHeight?: number;
};

export const SINGLE_VARIANT = "default";

export function defaults(params: ParamSpec[]): ParamValues {
	return Object.fromEntries(params.map((p) => [p.key, p.default]));
}
