// 设计变量约定（前后端共用，无 Node 依赖）：「打磨」只改这份变量。整理时 AI 把项目里散落的字体、颜色、圆角、阴影、间距
// 收拢成 TOKENS_FILE 里 :root 上的这些变量，页面外观不变；之后保存直接改这个文件里的值，不经 AI。

/** 设计变量文件，相对项目根目录。由入口样式引入（整理时 AI 负责接好）。 */
export const TOKENS_FILE = "src/design-tokens.css";

export type TokenGroup = "font" | "color" | "shape" | "density";

/** 全部设计变量：名字、分组和含义（含义也写进给 AI 的整理要求）。 */
export const DESIGN_TOKENS = [
	{ name: "--sui-font-sans", group: "font", meaning: "body text font stack" },
	{ name: "--sui-font-ui", group: "font", meaning: "optional control font stack; defaults to body; only added on explicit control font selection" },
	{ name: "--sui-font-heading", group: "font", meaning: "heading font stack" },
	{ name: "--sui-font-mono", group: "font", meaning: "monospace font stack" },
	{ name: "--sui-font-size-base", group: "font", meaning: "base body font size" },
	{ name: "--sui-color-primary", group: "color", meaning: "brand / primary action color" },
	{ name: "--sui-color-primary-contrast", group: "color", meaning: "text color on primary" },
	{ name: "--sui-color-bg", group: "color", meaning: "page background" },
	{ name: "--sui-color-surface", group: "color", meaning: "card / panel background" },
	{ name: "--sui-color-text", group: "color", meaning: "main text color" },
	{ name: "--sui-color-muted", group: "color", meaning: "secondary text color" },
	{ name: "--sui-color-border", group: "color", meaning: "border / divider color" },
	{ name: "--sui-radius-sm", group: "shape", meaning: "small radius (inputs, tags)" },
	{ name: "--sui-radius-md", group: "shape", meaning: "medium radius (buttons, cards)" },
	{ name: "--sui-radius-lg", group: "shape", meaning: "large radius (sections, dialogs)" },
	{ name: "--sui-shadow-sm", group: "shape", meaning: "subtle elevation shadow" },
	{ name: "--sui-shadow-md", group: "shape", meaning: "raised elevation shadow" },
	{ name: "--sui-space", group: "density", meaning: "base spacing unit; paddings and gaps are multiples via calc()" },
] as const satisfies readonly { name: `--sui-${string}`; group: TokenGroup; meaning: string }[];

export type TokenName = (typeof DESIGN_TOKENS)[number]["name"];
/** 变量名 → CSS 值（原样写入 CSS，例如 "8px"、"#3574f0"、"'Inter', sans-serif"）。 */
export type TokenValues = Partial<Record<TokenName, string>>;

/** 用户明确换字体时才启用同一套预览和保存规则；旧项目可能定义了变量但没用到。 */
export const FONT_RULES = {
	"--sui-font-sans": `body { font-family: var(--sui-font-sans) !important; }`,
	"--sui-font-heading": `:is(h1, h2, h3, h4, h5, h6, [role="heading"]) { font-family: var(--sui-font-heading) !important; }`,
	"--sui-font-ui": `:is(button, input, textarea, select, [role="button"], [role="tab"], [role="menuitem"]) { font-family: var(--sui-font-ui, var(--sui-font-sans)) !important; }`,
} as const;

export function fontRules(values: TokenValues) {
	return (Object.keys(FONT_RULES) as (keyof typeof FONT_RULES)[]).filter((name) => values[name]).map((name) => FONT_RULES[name]);
}
