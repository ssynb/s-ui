import type { Locale } from "../i18n.ts";
import type { ParamSpec, ParamValues, RangeParam, SelectParam, Text } from "./types.ts";

// 常用参数工厂：同一种参数（时长、缓动）在所有动效里叫法和取值范围一致。

export const EASE_OUT = "cubic-bezier(.2,.8,.2,1)";
export const SPRING = "cubic-bezier(.34,1.56,.64,1)";

export const EASINGS: SelectParam["options"] = [
	{ value: EASE_OUT, label: { zh: "先快后慢", en: "Ease out" } },
	{ value: "cubic-bezier(.4,0,1,1)", label: { zh: "先慢后快", en: "Ease in" } },
	{ value: "cubic-bezier(.65,0,.35,1)", label: { zh: "慢-快-慢", en: "Ease in-out" } },
	{ value: "linear", label: { zh: "匀速", en: "Linear" } },
	{ value: SPRING, label: { zh: "回弹", en: "Spring" } },
];

export function range(key: string, label: Text, min: number, max: number, step: number, unit: string, value: number): RangeParam {
	return { key, label, kind: "range", min, max, step, unit, default: value };
}

export const duration = (value: number) => range("duration", { zh: "时长", en: "Duration" }, 0, Math.max(1000, value * 2), 10, "ms", value);

export function easing(value = EASE_OUT): SelectParam {
	return { key: "easing", label: { zh: "缓动", en: "Easing" }, kind: "select", options: EASINGS, default: value, showValue: true };
}

export const n = (p: ParamValues, key: string) => Number(p[key]);
export const s = (p: ParamValues, key: string) => String(p[key]);

export function easeName(value: string | number): Text {
	return EASINGS.find((o) => o.value === value)?.label ?? { zh: String(value), en: String(value) };
}

/** 时长 + 缓动的口语说法，例：“140ms，先快后慢”。 */
export const timing = (p: ParamValues): Text => ({
	zh: `${n(p, "duration")}ms，${easeName(s(p, "easing")).zh}`,
	en: `${n(p, "duration")}ms, ${easeName(s(p, "easing")).en.toLowerCase()}`,
});

export function formatParam(spec: ParamSpec, value: number | string, locale: Locale): string {
	if (spec.kind === "range") return `${value}${spec.unit}`;
	const option = spec.options.find((o) => o.value === value);
	if (!option) return String(value);
	return spec.showValue ? `${option.label[locale]} ${option.value}` : option.label[locale];
}
