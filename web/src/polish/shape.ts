import type { TokenValues } from "../panels.ts";

// 形状与密度：三个滑块各自对应一组设计变量。

export type ShapeKnob = "radius" | "space" | "shadow";

export const SHAPE_RANGES: Record<ShapeKnob, { min: number; max: number; step: number; fallback: number }> = {
	radius: { min: 0, max: 24, step: 1, fallback: 8 },
	space: { min: 2, max: 10, step: 1, fallback: 4 },
	shadow: { min: 0, max: 4, step: 1, fallback: 1 },
};

/** 滑块值对应的变量：圆角以中号为准推出小号和大号；阴影 0 级为无阴影。 */
export function shapeTokens(knob: ShapeKnob, value: number): TokenValues {
	if (knob === "radius")
		return { "--sui-radius-sm": `${Math.round(value / 2)}px`, "--sui-radius-md": `${value}px`, "--sui-radius-lg": `${Math.round(value * 1.75)}px` };
	if (knob === "space") return { "--sui-space": `${value}px` };
	if (value === 0) return { "--sui-shadow-sm": "none", "--sui-shadow-md": "none" };
	return {
		"--sui-shadow-sm": `0 1px ${1 + value}px rgb(0 0 0 / ${(0.03 + value * 0.025).toFixed(3)})`,
		"--sui-shadow-md": `0 ${2 * value}px ${6 * value}px rgb(0 0 0 / ${(0.04 + value * 0.03).toFixed(3)})`,
	};
}

/** 从变量文件里的值推回滑块位置（认不出时用默认位置）。 */
export function shapeValue(knob: ShapeKnob, values: TokenValues): number {
	const px = (v?: string) => (v && /^-?[\d.]+px$/.test(v.trim()) ? Math.round(parseFloat(v)) : undefined);
	if (knob === "radius") return px(values["--sui-radius-md"]) ?? SHAPE_RANGES.radius.fallback;
	if (knob === "space") return px(values["--sui-space"]) ?? SHAPE_RANGES.space.fallback;
	const sm = values["--sui-shadow-sm"];
	if (sm?.trim() === "none") return 0;
	for (let level = 1; level <= SHAPE_RANGES.shadow.max; level++) if (shapeTokens("shadow", level)["--sui-shadow-sm"] === sm) return level;
	return SHAPE_RANGES.shadow.fallback;
}
