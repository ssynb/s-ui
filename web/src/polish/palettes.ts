import type { TokenValues } from "../panels.ts";
import { readableOn } from "./color.ts";
import type { Text } from "./types.ts";

// 配色方案：主色 + 背景、卡片底、正文、次要文字、边框；主色上的文字色按对比度自动算。

export type Palette = { id: string; name: Text; primary: string; bg: string; surface: string; text: string; muted: string; border: string };

export const PALETTES: Palette[] = [
	{ id: "ocean", name: { zh: "清爽蓝", en: "Ocean" }, primary: "#2563eb", bg: "#f8fafc", surface: "#ffffff", text: "#0f172a", muted: "#64748b", border: "#e2e8f0" },
	{ id: "forest", name: { zh: "森林绿", en: "Forest" }, primary: "#15803d", bg: "#f6f9f7", surface: "#ffffff", text: "#132219", muted: "#5b6b61", border: "#dbe5de" },
	{ id: "violet", name: { zh: "紫罗兰", en: "Violet" }, primary: "#7c3aed", bg: "#faf9ff", surface: "#ffffff", text: "#1e1633", muted: "#6b6480", border: "#e7e3f5" },
	{ id: "rose", name: { zh: "玫瑰", en: "Rose" }, primary: "#e11d48", bg: "#fffafb", surface: "#ffffff", text: "#2a1018", muted: "#7a5c66", border: "#f1dfe4" },
	{ id: "sunset", name: { zh: "落日橙", en: "Sunset" }, primary: "#ea580c", bg: "#fcfaf8", surface: "#ffffff", text: "#24160d", muted: "#76665c", border: "#eee3da" },
	{ id: "teal", name: { zh: "青碧", en: "Teal" }, primary: "#0d9488", bg: "#f7fbfa", surface: "#ffffff", text: "#0f2422", muted: "#58706d", border: "#d9e8e6" },
	{ id: "ink", name: { zh: "墨黑", en: "Ink" }, primary: "#18181b", bg: "#ffffff", surface: "#fafafa", text: "#18181b", muted: "#71717a", border: "#e4e4e7" },
	{ id: "midnight", name: { zh: "深夜", en: "Midnight" }, primary: "#60a5fa", bg: "#0b1020", surface: "#131a2e", text: "#e5e7eb", muted: "#94a3b8", border: "#25304d" },
];

export function primaryTokens(primary: string): TokenValues {
	return { "--sui-color-primary": primary, "--sui-color-primary-contrast": readableOn(primary) };
}

export function paletteTokens(p: Palette): TokenValues {
	return {
		...primaryTokens(p.primary),
		"--sui-color-bg": p.bg,
		"--sui-color-surface": p.surface,
		"--sui-color-text": p.text,
		"--sui-color-muted": p.muted,
		"--sui-color-border": p.border,
	};
}
