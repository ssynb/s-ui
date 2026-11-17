import type { Locale } from "../i18n.ts";

// 「参考页面」工具窗的全部文案。两种语言同时补齐，类型会检查缺漏。
const en = {
	title: "Reference pages",
	placeholder: "Pages from similar products and curated examples, to hand to the AI as a reference for a redesign. Coming soon.",
};

const zh: typeof en = {
	title: "参考页面",
	placeholder: "同类产品的页面和精选优质页面，选中后作为参考图交给 AI 改版。即将推出。",
};

export const STRINGS: Record<Locale, typeof en> = { en, zh };
