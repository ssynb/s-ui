// 颜色计算：WCAG 相对亮度与对比度，给主色挑一个可读的文字色。

const AA_TEXT = 4.5;

/** 解析 #rgb、#rrggbb、rgb()/rgba()，返回 0–255 的 RGB；认不出时为空。 */
export function parseColor(value: string): [number, number, number] | undefined {
	const v = value.trim();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)?.[1];
	if (hex) {
		const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
		return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
	}
	const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
	return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : undefined;
}

function luminance(value: string) {
	const rgb = parseColor(value) ?? [0, 0, 0];
	const [r, g, b] = rgb.map((c) => {
		const x = c / 255;
		return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

/** 主色上的文字色：白字够 4.5:1 就用白字，否则用黑字（任何底色上两者至少有一个达到 4.5:1）。 */
export function readableOn(background: string) {
	return contrastRatio(background, "#ffffff") >= AA_TEXT ? "#ffffff" : "#000000";
}

/** 转成 #rrggbb（供取色器使用）；认不出时为空。 */
export function toHex(value: string) {
	const rgb = parseColor(value);
	return rgb && `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}
