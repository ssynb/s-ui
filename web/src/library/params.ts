import type { ColorParam, ParamValues, RangeParam, SelectParam, Text } from "./types.ts";

// 条目常用参数的工厂：同一种参数（时长、缓动、圆角、颜色）在所有条目里叫法和取值范围一致。

export const ACCENT = "#3574f0";
export const EASE_OUT = "cubic-bezier(.2,.8,.2,1)";
export const EASE_IN = "cubic-bezier(.4,0,1,1)";
export const SPRING = "cubic-bezier(.34,1.56,.64,1)";

export const EASINGS: SelectParam["options"] = [
	{ value: EASE_OUT, label: { zh: "先快后慢", en: "Ease out (fast, then settles)" } },
	{ value: EASE_IN, label: { zh: "先慢后快", en: "Ease in (slow start, speeds away)" } },
	{ value: "cubic-bezier(.65,0,.35,1)", label: { zh: "慢-快-慢", en: "Ease in-out" } },
	{ value: "linear", label: { zh: "匀速", en: "Linear" } },
	{ value: SPRING, label: { zh: "回弹", en: "Spring (slight overshoot)" } },
];

export function range(key: string, label: Text, min: number, max: number, step: number, unit: string, value: number): RangeParam {
	return { key, label, kind: "range", min, max, step, unit, default: value };
}

export const duration = (value: number, key = "duration", label: Text = { zh: "时长", en: "Duration" }) => range(key, label, 0, Math.max(1000, value * 2), 10, "ms", value);

export function easing(value = EASE_OUT, key = "easing", label: Text = { zh: "缓动", en: "Easing" }): SelectParam {
	return { key, label, kind: "select", options: EASINGS, default: value, showValue: true };
}

export const radius = (value: number, max = 24) => range("radius", { zh: "圆角", en: "Corner radius" }, 0, max, 1, "px", value);

export function color(value = ACCENT, key = "color", label: Text = { zh: "颜色", en: "Color" }): ColorParam {
	return { key, label, kind: "color", default: value };
}

/** 读数值参数。 */
export const n = (p: ParamValues, key: string) => Number(p[key]);
/** 读文本参数（颜色、缓动等）。 */
export const s = (p: ParamValues, key: string) => String(p[key]);

/** 缓动的名字，用在“怎么跟 AI 说”里。 */
export function easeName(value: string | number): Text {
	return EASINGS.find((o) => o.value === value)?.label ?? { zh: String(value), en: String(value) };
}
