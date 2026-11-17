import { COMPONENT_ENTRIES } from "./components.tsx";
import { MOTION_ENTRIES } from "./motion.tsx";
import type { CategoryId, Entry, Text } from "./types.ts";

// 组件库的注册表。新增条目：在 motion.tsx 或 components.tsx 的数组里加一个 Entry；新增分类再在这里加一项。

export type Category = { id: CategoryId; group: "motion" | "components"; name: Text };

export const CATEGORIES: Category[] = [
	{ id: "feedback", group: "motion", name: { zh: "控件反馈", en: "Feedback" } },
	{ id: "transition", group: "motion", name: { zh: "出现与切换", en: "Enter & switch" } },
	{ id: "waiting", group: "motion", name: { zh: "等待与数字", en: "Waiting & numbers" } },
	{ id: "personality", group: "motion", name: { zh: "个性动效", en: "Signature motion" } },
	{ id: "button", group: "components", name: { zh: "按钮", en: "Buttons" } },
	{ id: "input", group: "components", name: { zh: "输入框", en: "Inputs" } },
	{ id: "switch", group: "components", name: { zh: "开关", en: "Switches" } },
	{ id: "tabs", group: "components", name: { zh: "标签页", en: "Tabs" } },
	{ id: "card", group: "components", name: { zh: "卡片", en: "Cards" } },
	{ id: "toast", group: "components", name: { zh: "轻提示", en: "Toasts" } },
	{ id: "empty", group: "components", name: { zh: "空状态", en: "Empty states" } },
	{ id: "loading", group: "components", name: { zh: "加载", en: "Loading" } },
];

export const ENTRIES: Entry[] = [...MOTION_ENTRIES, ...COMPONENT_ENTRIES];
