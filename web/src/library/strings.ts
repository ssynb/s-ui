import type { Locale } from "../i18n.ts";

// 「组件库」工具窗的全部文案。两种语言同时补齐，类型会检查缺漏。
const en = {
	title: "Component library",
	placeholder: "Live demos of motion and components you can tune and hand to the AI. Coming soon.",
	selectionHint: (n: number) => (n === 1 ? "1 element circled in the preview" : `${n} elements circled in the preview`),
};

const zh: typeof en = {
	title: "组件库",
	placeholder: "可调参数的动效和组件演示，一键交给 AI 用到你的页面上。即将推出。",
	selectionHint: (n: number) => `预览里已圈选 ${n} 个元素`,
};

export const STRINGS: Record<Locale, typeof en> = { en, zh };
