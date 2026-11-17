import type { Locale } from "../i18n.ts";

// 「打磨」工具窗的全部文案。两种语言同时补齐，类型会检查缺漏。
const en = {
	title: "Polish",
	placeholder: "Fonts, colors, shape and the components on this page — click to preview, save when you like it. Coming soon.",
};

const zh: typeof en = {
	title: "打磨",
	placeholder: "字体、配色、形状和这个页面里的组件，点一下预览立刻变，满意再保存。即将推出。",
};

export const STRINGS: Record<Locale, typeof en> = { en, zh };
