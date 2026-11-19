import type { Text } from "./types.ts";

export const FONT_ROLES = { heading: "--sui-font-heading", body: "--sui-font-sans", ui: "--sui-font-ui" } as const;
export type FontRole = keyof typeof FONT_ROLES;
export type FontChoice = { id: string; name: Text; family: string; urls: string[] };
const google = (...families: string[]) => `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, "+")}`).join("&")}&display=swap`;

// Google Fonts 官方 ofl 目录的 METADATA.pb / OFL.txt：中文字体均声明 chinese-simplified，全部 SIL OFL 1.1。
// 西文字体在前，汉字由随后明确配对的简体中文字体提供；不把日文字库当作完整中文覆盖。
export const FONTS: FontChoice[] = [
	{ id: "system", name: { zh: "系统默认", en: "System" }, family: "system-ui, sans-serif", urls: [] },
	{
		id: "geometric",
		name: { zh: "几何黑体 · Space Grotesk / 思源黑体", en: "Geometric · Space Grotesk / Noto Sans SC" },
		family: "'Space Grotesk', 'Noto Sans SC', sans-serif",
		urls: [google("Space Grotesk:wght@400;700", "Noto Sans SC:wght@400;700")],
	},
	{
		id: "literary",
		name: { zh: "文艺宋体 · Fraunces / 站酷小薇", en: "Literary · Fraunces / ZCOOL XiaoWei" },
		family: "'Fraunces', 'ZCOOL XiaoWei', serif",
		urls: [google("Fraunces:wght@400;700", "ZCOOL XiaoWei")],
	},
	{ id: "playful", name: { zh: "快乐圆体 · 站酷快乐", en: "Playful · ZCOOL KuaiLe" }, family: "'ZCOOL KuaiLe', sans-serif", urls: [google("ZCOOL KuaiLe")] },
	{
		id: "brush",
		name: { zh: "毛笔手写 · Caveat / 马善政", en: "Brush · Caveat / Ma Shan Zheng" },
		family: "'Caveat', 'Ma Shan Zheng', cursive",
		urls: [google("Caveat:wght@400;700", "Ma Shan Zheng")],
	},
];
