import type { TokenValues } from "../panels.ts";
import type { Text } from "./types.ts";

// 中英字体搭配：全部来自免费网页字体服务（Google Fonts；霞鹜文楷来自 jsDelivr 上的 lxgw-wenkai-webfont）。
// 选中后改 --sui-font-sans / --sui-font-heading（等宽搭配也改 --sui-font-mono），保存时把 urls 写成变量文件顶部的 @import。

export type FontPair = {
	id: string;
	name: Text;
	/** 风格类别，便于扫读。 */
	style: Text;
	sans: string;
	heading: string;
	mono?: string;
	urls: string[];
};

const google = (...families: string[]) => `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, "+")}`).join("&")}&display=swap`;
const WENKAI = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css";
const WENKAI_BOLD = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-bold.css";

const SANS_SC = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei'";
const SERIF_SC = "'Noto Serif SC', 'Songti SC', SimSun";

export const FONT_PAIRS: FontPair[] = [
	{
		id: "system",
		name: { zh: "系统默认", en: "System" },
		style: { zh: "无衬线 · 不加载字体", en: "Sans · no downloads" },
		sans: "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
		heading: "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
		urls: [],
	},
	{
		id: "inter",
		name: { zh: "Inter + 思源黑体", en: "Inter + Noto Sans SC" },
		style: { zh: "现代无衬线", en: "Modern sans" },
		sans: `'Inter', ${SANS_SC}, sans-serif`,
		heading: `'Inter', ${SANS_SC}, sans-serif`,
		urls: [google("Inter:wght@400;500;600;700", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "manrope",
		name: { zh: "Manrope + 思源黑体", en: "Manrope + Noto Sans SC" },
		style: { zh: "几何无衬线", en: "Geometric sans" },
		sans: `'Manrope', ${SANS_SC}, sans-serif`,
		heading: `'Manrope', ${SANS_SC}, sans-serif`,
		urls: [google("Manrope:wght@400;500;700;800", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "grotesk",
		name: { zh: "Space Grotesk + Inter", en: "Space Grotesk + Inter" },
		style: { zh: "科技感标题", en: "Techy headings" },
		sans: `'Inter', ${SANS_SC}, sans-serif`,
		heading: `'Space Grotesk', ${SANS_SC}, sans-serif`,
		urls: [google("Space Grotesk:wght@500;700", "Inter:wght@400;500;600", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "plex",
		name: { zh: "IBM Plex Sans + 思源黑体", en: "IBM Plex Sans + Noto Sans SC" },
		style: { zh: "稳重无衬线", en: "Sturdy sans" },
		sans: `'IBM Plex Sans', ${SANS_SC}, sans-serif`,
		heading: `'IBM Plex Sans', ${SANS_SC}, sans-serif`,
		urls: [google("IBM Plex Sans:wght@400;500;600;700", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "serif",
		name: { zh: "Source Serif + 思源宋体", en: "Source Serif + Noto Serif SC" },
		style: { zh: "经典衬线", en: "Classic serif" },
		sans: `'Source Serif 4', ${SERIF_SC}, serif`,
		heading: `'Source Serif 4', ${SERIF_SC}, serif`,
		urls: [google("Source Serif 4:wght@400;600;700", "Noto Serif SC:wght@400;600;700")],
	},
	{
		id: "editorial",
		name: { zh: "Playfair 标题 + 思源黑体正文", en: "Playfair headings + Noto Sans body" },
		style: { zh: "杂志感衬线标题", en: "Editorial serif headings" },
		sans: `'Inter', ${SANS_SC}, sans-serif`,
		heading: `'Playfair Display', ${SERIF_SC}, serif`,
		urls: [google("Playfair Display:wght@500;700", "Noto Serif SC:wght@500;700", "Inter:wght@400;500;600", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "fraunces",
		name: { zh: "Fraunces + 站酷小薇", en: "Fraunces + ZCOOL XiaoWei" },
		style: { zh: "文艺衬线标题", en: "Literary serif headings" },
		sans: `'DM Sans', ${SANS_SC}, sans-serif`,
		heading: `'Fraunces', 'ZCOOL XiaoWei', ${SERIF_SC}, serif`,
		urls: [google("Fraunces:wght@500;700", "ZCOOL XiaoWei", "DM Sans:wght@400;500;700", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "rounded",
		name: { zh: "Nunito + M PLUS 圆体", en: "Nunito + M PLUS Rounded" },
		style: { zh: "圆体 · 亲和", en: "Rounded · friendly" },
		sans: `'Nunito', 'M PLUS Rounded 1c', ${SANS_SC}, sans-serif`,
		heading: `'Nunito', 'M PLUS Rounded 1c', ${SANS_SC}, sans-serif`,
		urls: [google("Nunito:wght@400;600;800", "M PLUS Rounded 1c:wght@400;700", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "kuaile",
		name: { zh: "站酷快乐体 + Nunito", en: "ZCOOL KuaiLe + Nunito" },
		style: { zh: "活泼圆润标题", en: "Playful rounded headings" },
		sans: `'Nunito', ${SANS_SC}, sans-serif`,
		heading: `'ZCOOL KuaiLe', 'Nunito', ${SANS_SC}, sans-serif`,
		urls: [google("ZCOOL KuaiLe", "Nunito:wght@400;600;800", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "wenkai",
		name: { zh: "霞鹜文楷 + Lora", en: "LXGW WenKai + Lora" },
		style: { zh: "手写感楷体", en: "Handwritten kai" },
		sans: "'Lora', 'LXGW WenKai', 'Kaiti SC', serif",
		heading: "'Lora', 'LXGW WenKai', 'Kaiti SC', serif",
		urls: [google("Lora:wght@400;600;700"), WENKAI, WENKAI_BOLD],
	},
	{
		id: "brush",
		name: { zh: "马善政毛笔 + Caveat 标题", en: "Ma Shan Zheng + Caveat headings" },
		style: { zh: "毛笔手写标题", en: "Brush script headings" },
		sans: `'Inter', ${SANS_SC}, sans-serif`,
		heading: "'Caveat', 'Ma Shan Zheng', cursive",
		urls: [google("Caveat:wght@600;700", "Ma Shan Zheng", "Inter:wght@400;500;600", "Noto Sans SC:wght@400;500;700")],
	},
	{
		id: "mono",
		name: { zh: "JetBrains Mono + 思源黑体", en: "JetBrains Mono + Noto Sans SC" },
		style: { zh: "等宽 · 极客", en: "Monospace · geeky" },
		sans: `'JetBrains Mono', ${SANS_SC}, monospace`,
		heading: `'JetBrains Mono', ${SANS_SC}, monospace`,
		mono: "'JetBrains Mono', ui-monospace, monospace",
		urls: [google("JetBrains Mono:wght@400;600;700", "Noto Sans SC:wght@400;500;700")],
	},
];

export function fontTokens(pair: FontPair): TokenValues {
	return { "--sui-font-sans": pair.sans, "--sui-font-heading": pair.heading, ...(pair.mono ? { "--sui-font-mono": pair.mono } : {}) };
}
