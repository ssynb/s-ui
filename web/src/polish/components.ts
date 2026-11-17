import type { ComponentKind, FoundComponent } from "../panels.ts";
import { parseColor } from "./color.ts";
import type { Text } from "./types.ts";

// 页面里各类组件的替换做法（按钮、输入框、卡片源自原组件库）。每种做法生成一层只作用于该组件组的临时样式：
// 规则一律以 :is(groupSelector) 开头，颜色、圆角、阴影优先取设计变量，没整理过的页面退回到代表元素的计算样式。

/** 试用样式的上下文：目标选择器和带回退值的设计变量。 */
export type StyleContext = {
	/** :is(groupSelector)，所有规则以它开头。 */
	s: string;
	primary: string;
	onPrimary: string;
	text: string;
	muted: string;
	surface: string;
	border: string;
	radiusSm: string;
	radiusMd: string;
	radiusLg: string;
	shadowSm: string;
	shadowMd: string;
};

export type ComponentVariant = {
	id: string;
	name: Text;
	/** 这种做法的外观与行为，写进交给 AI 的需求。 */
	look: Text;
	css: (c: StyleContext) => string;
};

const isTransparent = (color?: string) => !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);

export function styleContext(found: FoundComponent): StyleContext {
	const { backgroundColor, color, borderRadius } = found.styles;
	const brand = !isTransparent(backgroundColor) && parseColor(backgroundColor!) ? backgroundColor : "#3574f0";
	const radius = borderRadius && borderRadius !== "0px" ? borderRadius : "8px";
	return {
		s: `:is(${found.groupSelector})`,
		primary: `var(--sui-color-primary, ${found.kind === "button" ? brand : "#3574f0"})`,
		onPrimary: `var(--sui-color-primary-contrast, ${found.kind === "button" && color ? color : "#ffffff"})`,
		text: "var(--sui-color-text, currentColor)",
		muted: "var(--sui-color-muted, rgb(0 0 0 / .55))",
		surface: "var(--sui-color-surface, #ffffff)",
		border: "var(--sui-color-border, rgb(0 0 0 / .12))",
		radiusSm: `var(--sui-radius-sm, calc(${radius} / 2))`,
		radiusMd: `var(--sui-radius-md, ${radius})`,
		radiusLg: `var(--sui-radius-lg, calc(${radius} * 2))`,
		shadowSm: "var(--sui-shadow-sm, 0 1px 2px rgb(0 0 0 / .08))",
		shadowMd: "var(--sui-shadow-md, 0 6px 18px rgb(0 0 0 / .12))",
	};
}

/** 一条规则；试用层要压过页面自身样式，声明一律 !important。 */
export function rule(selector: string, decls: Record<string, string>) {
	return `${selector} { ${Object.entries(decls)
		.map(([k, v]) => `${k}: ${v} !important;`)
		.join(" ")} }`;
}

const mix = (color: string, pct: number, base = "transparent") => `color-mix(in oklab, ${color} ${pct}%, ${base})`;
const v = (id: string, zh: string, en: string, look: Text, css: (c: StyleContext) => string[]): ComponentVariant => ({
	id,
	name: { zh, en },
	look,
	css: (c) => css(c).join("\n"),
});
const ease = "160ms cubic-bezier(.2,.8,.2,1)";

export const COMPONENT_VARIANTS: Partial<Record<ComponentKind, ComponentVariant[]>> = {
	button: [
		v("solid", "实底", "Solid", { zh: "实底按钮：主色底、主色上的文字色，悬停略提亮", en: "Solid button: primary fill with the on-primary text color, slightly lighter on hover" }, (c) => [
			rule(c.s, { background: c.primary, color: c.onPrimary, border: "0", "border-radius": c.radiusMd, "box-shadow": "none", transition: `filter ${ease}, transform ${ease}` }),
			rule(`${c.s}:hover`, { filter: "brightness(1.08)" }),
		]),
		v("soft", "柔和底", "Soft / tonal", { zh: "柔和底按钮：主色 14% 浅色作底、主色文字，悬停底色加深", en: "Soft button: primary at 14% as the fill with primary text, fill deepens on hover" }, (c) => [
			rule(c.s, { background: mix(c.primary, 14), color: c.primary, border: "0", "border-radius": c.radiusMd, "box-shadow": "none", transition: `background ${ease}` }),
			rule(`${c.s}:hover`, { background: mix(c.primary, 22) }),
		]),
		v("outline", "描边", "Outline", { zh: "描边按钮：透明底、1px 中性描边、正文色文字，悬停铺一层浅灰", en: "Outline button: transparent fill, 1px neutral border, body-color text, faint gray fill on hover" }, (c) => [
			rule(c.s, { background: "transparent", color: c.text, border: "0", "box-shadow": `inset 0 0 0 1px ${mix(c.text, 22)}`, "border-radius": c.radiusMd, transition: `background ${ease}` }),
			rule(`${c.s}:hover`, { background: mix(c.text, 6) }),
		]),
		v("raised", "立体光泽", "Raised / glossy", { zh: "立体按钮：主色由浅到深的竖向渐变、顶部 1px 内高光、细描边和小阴影", en: "Raised button: vertical primary gradient from light to dark, 1px inner top highlight, thin border and small shadow" }, (c) => [
			rule(c.s, {
				background: `linear-gradient(to bottom, ${mix(c.primary, 82, "white")}, ${c.primary})`,
				color: c.onPrimary,
				border: "0",
				"border-radius": c.radiusMd,
				"box-shadow": `inset 0 1px 0 rgb(255 255 255 / .28), 0 0 0 1px ${mix(c.primary, 75, "black")}, 0 1px 3px rgb(0 0 0 / .25)`,
			}),
			rule(`${c.s}:hover`, { filter: "brightness(1.06)" }),
		]),
	],
	link: [
		v("underline", "常驻下划线", "Underlined", { zh: "链接常驻主色细下划线，离文字 3px，悬停加粗下划线", en: "Links keep a thin primary underline 3px below the text, thicker on hover" }, (c) => [
			rule(c.s, { color: c.primary, "text-decoration": "underline", "text-decoration-thickness": "1px", "text-underline-offset": "3px" }),
			rule(`${c.s}:hover`, { "text-decoration-thickness": "2px" }),
		]),
		v("quiet", "低调", "Quiet", { zh: "链接和正文同色、不带下划线，悬停时变主色并出现下划线", en: "Links match body text without underline; on hover they turn primary and get an underline" }, (c) => [
			rule(c.s, { color: "inherit", "text-decoration": "none", transition: `color ${ease}` }),
			rule(`${c.s}:hover`, { color: c.primary, "text-decoration": "underline", "text-underline-offset": "3px" }),
		]),
		v("accent", "主色加粗", "Bold accent", { zh: "链接用主色、半粗、无下划线，悬停变淡", en: "Links in primary, semibold, no underline, fading slightly on hover" }, (c) => [
			rule(c.s, { color: c.primary, "font-weight": "600", "text-decoration": "none", transition: `opacity ${ease}` }),
			rule(`${c.s}:hover`, { opacity: ".75" }),
		]),
	],
	input: [
		v("outline", "描边", "Outline", { zh: "描边输入框：1px 中性描边，聚焦时描边变主色并外加 3px 浅色光晕", en: "Outline input: 1px neutral border; on focus the border turns primary with a soft 3px halo" }, (c) => [
			rule(c.s, { background: c.surface, border: `1px solid ${mix(c.text, 20)}`, "border-radius": c.radiusSm, "box-shadow": "none", outline: "none", transition: `border-color ${ease}, box-shadow ${ease}` }),
			rule(`${c.s}:focus`, { "border-color": c.primary, "box-shadow": `0 0 0 3px ${mix(c.primary, 22)}` }),
		]),
		v("filled", "填充底", "Filled", { zh: "填充输入框：浅灰底、无描边，聚焦时变白底并出现 2px 主色描边", en: "Filled input: light gray fill without border; on focus it turns white with a 2px primary border" }, (c) => [
			rule(c.s, { background: mix(c.text, 6), border: "0", "border-radius": c.radiusSm, "box-shadow": "none", outline: "none", transition: `background ${ease}, box-shadow ${ease}` }),
			rule(`${c.s}:focus`, { background: c.surface, "box-shadow": `inset 0 0 0 2px ${c.primary}` }),
		]),
		v("underline", "下划线", "Underline", { zh: "下划线输入框：只有底部一条线，聚焦时线变主色并加粗", en: "Underline input: only a bottom line, which turns primary and thicker on focus" }, (c) => [
			rule(c.s, { background: "transparent", border: "0", "border-bottom": `1px solid ${mix(c.text, 25)}`, "border-radius": "0", "box-shadow": "none", outline: "none" }),
			rule(`${c.s}:focus`, { "border-bottom-color": c.primary, "box-shadow": `0 1px 0 ${c.primary}` }),
		]),
	],
	card: [
		v("border", "细描边", "Border", { zh: "细描边卡片：1px 中性浅灰描边、无阴影，悬停描边加深", en: "Border card: 1px light neutral border, no shadow, border darkens on hover" }, (c) => [
			rule(c.s, { background: c.surface, border: `1px solid ${c.border}`, "box-shadow": "none", "border-radius": c.radiusMd, transition: `border-color ${ease}` }),
			rule(`${c.s}:hover`, { "border-color": mix(c.text, 25) }),
		]),
		v("shadow", "阴影描边", "Shadow border", { zh: "阴影描边卡片：半透明 1px 环加很淡的阴影，悬停略加深", en: "Shadow-border card: translucent 1px ring plus a faint shadow, slightly deeper on hover" }, (c) => [
			rule(c.s, { background: c.surface, border: "0", "border-radius": c.radiusMd, "box-shadow": `0 0 0 1px rgb(0 0 0 / .06), ${c.shadowSm}`, transition: `box-shadow ${ease}` }),
			rule(`${c.s}:hover`, { "box-shadow": `0 0 0 1px rgb(0 0 0 / .1), ${c.shadowMd}` }),
		]),
		v("lift", "悬停抬起", "Lift on hover", { zh: "悬停抬起卡片：悬停时上浮 3px、阴影变深，按下时下沉回去", en: "Lift card: floats up 3px with a deeper shadow on hover and sinks back when pressed" }, (c) => [
			rule(c.s, { background: c.surface, border: `1px solid ${c.border}`, "border-radius": c.radiusMd, "box-shadow": c.shadowSm, transition: `transform ${ease}, box-shadow ${ease}` }),
			rule(`${c.s}:hover`, { transform: "translateY(-3px)", "box-shadow": c.shadowMd }),
			rule(`${c.s}:active`, { transform: "translateY(0)" }),
		]),
		v("tinted", "浅色底", "Tinted", { zh: "浅色底卡片：主色 8% 浅色铺底、无描边无阴影", en: "Tinted card: primary at 8% as the fill, no border or shadow" }, (c) => [
			rule(c.s, { background: mix(c.primary, 8, c.surface), border: "0", "box-shadow": "none", "border-radius": c.radiusMd }),
		]),
	],
	badge: [
		v("soft", "柔和胶囊", "Soft pill", { zh: "胶囊标签：主色 14% 浅底、主色文字、小字半粗", en: "Pill badge: primary at 14% fill, primary text, small semibold" }, (c) => [
			rule(c.s, { background: mix(c.primary, 14), color: c.primary, border: "0", "border-radius": "999px", padding: "2px 8px", "font-weight": "600", "font-size": "12px" }),
		]),
		v("outline", "描边", "Outline", { zh: "描边标签：透明底、1px 中性描边、次要文字色", en: "Outline badge: transparent, 1px neutral border, muted text" }, (c) => [
			rule(c.s, { background: "transparent", color: c.muted, border: `1px solid ${c.border}`, "border-radius": c.radiusSm, padding: "1px 6px", "font-size": "12px" }),
		]),
		v("solid", "实底", "Solid", { zh: "实底标签：主色底、主色上的文字色", en: "Solid badge: primary fill with on-primary text" }, (c) => [
			rule(c.s, { background: c.primary, color: c.onPrimary, border: "0", "border-radius": c.radiusSm, padding: "2px 8px", "font-weight": "600", "font-size": "12px" }),
		]),
	],
	heading: [
		v("tight", "紧凑粗体", "Tight bold", { zh: "标题粗体、字距收紧 -0.02em、行高 1.15", en: "Headings bold with -0.02em tracking and 1.15 line height" }, (c) => [
			rule(c.s, { "font-weight": "700", "letter-spacing": "-0.02em", "line-height": "1.15" }),
		]),
		v("airy", "轻盈", "Light and airy", { zh: "标题常规字重、字距略收、颜色用正文色", en: "Headings in regular weight, slightly tighter tracking, body text color" }, (c) => [
			rule(c.s, { "font-weight": "400", "letter-spacing": "-0.01em", color: c.text }),
		]),
		v("serif", "衬线标题", "Serif display", { zh: "标题换成衬线字体，常规字重", en: "Headings in a serif typeface, regular weight" }, (c) => [
			rule(c.s, { "font-family": 'Georgia, "Noto Serif SC", "Songti SC", serif', "font-weight": "500", "letter-spacing": "-0.01em" }),
		]),
	],
	image: [
		v("rounded", "大圆角", "Rounded", { zh: "图片用大圆角裁切", en: "Images clipped with large rounded corners" }, (c) => [rule(c.s, { "border-radius": c.radiusLg })]),
		v("framed", "细框", "Framed", { zh: "图片加 1px 中性细框和中等圆角，避免浅色图和背景糊在一起", en: "Images get a 1px neutral outline and medium corners so light images don't blend into the page" }, (c) => [
			rule(c.s, { "border-radius": c.radiusMd, outline: "1px solid rgb(0 0 0 / .1)", "outline-offset": "-1px" }),
		]),
		v("shadow", "投影", "Shadow", { zh: "图片中等圆角加柔和投影，像浮在页面上", en: "Images with medium corners and a soft shadow, floating above the page" }, (c) => [
			rule(c.s, { "border-radius": c.radiusMd, "box-shadow": c.shadowMd }),
		]),
	],
	nav: [
		v("bordered", "底部分割线", "Bottom divider", { zh: "导航栏与页面同色，底部一条 1px 分割线", en: "Navigation matches the page background with a 1px bottom divider" }, (c) => [
			rule(c.s, { background: "var(--sui-color-bg, transparent)", "border-bottom": `1px solid ${c.border}`, "box-shadow": "none" }),
		]),
		v("frosted", "磨砂吸顶", "Frosted sticky", { zh: "导航栏吸顶，半透明背景加背景模糊，底部细分割线", en: "Sticky navigation with a translucent blurred background and a thin bottom divider" }, (c) => [
			rule(c.s, { position: "sticky", top: "0", "z-index": "50", background: mix(c.surface, 78), "backdrop-filter": "blur(12px)", "border-bottom": `1px solid ${c.border}` }),
		]),
		v("elevated", "浮起", "Elevated", { zh: "导航栏用卡片底色和小阴影，与内容分层", en: "Navigation on the surface color with a small shadow, layered above content" }, (c) => [
			rule(c.s, { background: c.surface, "box-shadow": c.shadowSm, "border-bottom": "0" }),
		]),
	],
	list: [
		v("divided", "分割线", "Divided", { zh: "列表去掉圆点，每项之间一条 1px 分割线、上下留白", en: "List without bullets, a 1px divider between items with vertical padding" }, (c) => [
			rule(c.s, { "list-style": "none", "padding-left": "0" }),
			rule(`${c.s} > *`, { padding: "10px 0", "border-bottom": `1px solid ${c.border}` }),
			rule(`${c.s} > *:last-child`, { "border-bottom": "0" }),
		]),
		v("cards", "卡片行", "Card rows", { zh: "列表每项做成独立小卡片：卡片底色、细描边、中等圆角，项间 8px", en: "Each list item becomes a small card: surface fill, thin border, medium corners, 8px apart" }, (c) => [
			rule(c.s, { "list-style": "none", "padding-left": "0", display: "grid", gap: "8px" }),
			rule(`${c.s} > *`, { background: c.surface, border: `1px solid ${c.border}`, "border-radius": c.radiusMd, padding: "10px 12px" }),
		]),
		v("plain", "留白分组", "Plain spacing", { zh: "列表去掉圆点和分割线，只靠项间留白分组", en: "List without bullets or dividers, grouped by spacing alone" }, (c) => [
			rule(c.s, { "list-style": "none", "padding-left": "0", display: "grid", gap: "12px" }),
		]),
	],
	table: [
		v("lines", "横线", "Row lines", { zh: "表格只保留行间横线，去掉竖线，表头次要文字色", en: "Table with row lines only, no vertical lines, header in muted text" }, (c) => [
			rule(c.s, { "border-collapse": "collapse" }),
			rule(`${c.s} :is(th, td)`, { border: "0", "border-bottom": `1px solid ${c.border}`, padding: "10px 12px", "text-align": "left" }),
			rule(`${c.s} th`, { color: c.muted, "font-weight": "500" }),
		]),
		v("striped", "斑马纹", "Striped", { zh: "表格隔行浅灰底，无边框", en: "Table with alternating light gray rows and no borders" }, (c) => [
			rule(c.s, { "border-collapse": "collapse" }),
			rule(`${c.s} :is(th, td)`, { border: "0", padding: "10px 12px" }),
			rule(`${c.s} tbody tr:nth-child(even)`, { background: mix(c.text, 4) }),
		]),
		v("compact", "紧凑", "Compact", { zh: "表格紧凑行高、细横线、数字等宽", en: "Compact table rows, thin row lines, tabular numbers" }, (c) => [
			rule(c.s, { "border-collapse": "collapse", "font-variant-numeric": "tabular-nums" }),
			rule(`${c.s} :is(th, td)`, { border: "0", "border-bottom": `1px solid ${c.border}`, padding: "4px 8px" }),
		]),
	],
	dialog: [
		v("soft", "柔和浮层", "Soft", { zh: "弹窗大圆角、无描边、柔和大阴影", en: "Dialog with large corners, no border and a soft large shadow" }, (c) => [
			rule(c.s, { "border-radius": c.radiusLg, border: "0", "box-shadow": "0 24px 64px rgb(0 0 0 / .18)", background: c.surface }),
		]),
		v("bordered", "细框", "Bordered", { zh: "弹窗中等圆角、1px 描边、小阴影", en: "Dialog with medium corners, a 1px border and a small shadow" }, (c) => [
			rule(c.s, { "border-radius": c.radiusMd, border: `1px solid ${c.border}`, "box-shadow": c.shadowMd, background: c.surface }),
		]),
		v("square", "直角", "Square", { zh: "弹窗直角、细描边、无阴影，更克制", en: "Square dialog with a thin border and no shadow, more restrained" }, (c) => [
			rule(c.s, { "border-radius": "0", border: `1px solid ${c.border}`, "box-shadow": "none", background: c.surface }),
		]),
	],
	footer: [
		v("subtle", "浅底", "Subtle", { zh: "页脚用卡片底色、顶部 1px 分割线、次要文字色", en: "Footer on the surface color with a 1px top divider and muted text" }, (c) => [
			rule(c.s, { background: c.surface, "border-top": `1px solid ${c.border}`, color: c.muted }),
		]),
		v("dark", "深色", "Dark", { zh: "页脚深色底（正文色）、浅色文字（页面背景色）", en: "Dark footer using the text color as background and the page background as text" }, (c) => [
			rule(c.s, { background: c.text, color: "var(--sui-color-bg, #ffffff)", "border-top": "0" }),
		]),
		v("minimal", "极简", "Minimal", { zh: "页脚透明、无分割线、小号次要文字", en: "Transparent footer without divider, small muted text" }, (c) => [
			rule(c.s, { background: "transparent", "border-top": "0", color: c.muted, "font-size": "13px" }),
		]),
	],
};

export const KIND_NAMES: Record<ComponentKind, Text> = {
	button: { zh: "按钮", en: "Buttons" },
	link: { zh: "链接", en: "Links" },
	input: { zh: "输入框", en: "Inputs" },
	card: { zh: "卡片", en: "Cards" },
	nav: { zh: "导航栏", en: "Navigation" },
	heading: { zh: "标题", en: "Headings" },
	image: { zh: "图片", en: "Images" },
	list: { zh: "列表", en: "Lists" },
	badge: { zh: "标签", en: "Badges" },
	table: { zh: "表格", en: "Tables" },
	dialog: { zh: "弹窗", en: "Dialogs" },
	footer: { zh: "页脚", en: "Footer" },
};

/** 每类组件需要覆盖的状态，写进交给 AI 的需求。 */
export const KIND_STATES: Record<ComponentKind, Text> = {
	button: { zh: "默认、悬停、按下、键盘聚焦、禁用（变淡）、加载", en: "default, hover, pressed, keyboard focus, disabled (dimmed), loading" },
	link: { zh: "默认、悬停、键盘聚焦、已访问（与默认一致）", en: "default, hover, keyboard focus, visited (same as default)" },
	input: { zh: "默认、悬停、聚焦、已填、错误（文字提示在下方）、禁用", en: "default, hover, focus, filled, error (message below), disabled" },
	card: { zh: "默认、悬停、按下、键盘聚焦（可点时）", en: "default, hover, pressed, keyboard focus (when clickable)" },
	nav: { zh: "默认、当前页高亮、滚动后（吸顶时）", en: "default, current page highlighted, scrolled (when sticky)" },
	heading: { zh: "各级标题保持同一风格，长标题换行平衡", en: "all heading levels share the style; long headings wrap evenly" },
	image: { zh: "加载中占位、加载完成、加载失败", en: "loading placeholder, loaded, failed" },
	list: { zh: "空列表、少量、很多项", en: "empty, few items, many items" },
	badge: { zh: "各种状态颜色保持同一形状", en: "all status colors share the same shape" },
	table: { zh: "表头、普通行、悬停行、空表", en: "header, rows, hovered row, empty table" },
	dialog: { zh: "打开、关闭、键盘可关闭（Esc）", en: "open, closed, closable by keyboard (Esc)" },
	footer: { zh: "宽屏与窄屏", en: "wide and narrow screens" },
};

export function componentLayer(found: FoundComponent, variantId: string) {
	const variant = COMPONENT_VARIANTS[found.kind]?.find((x) => x.id === variantId);
	return variant ? variant.css(styleContext(found)) : "";
}
