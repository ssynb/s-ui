import { DESIGN_TOKENS, TOKENS_FILE } from "../../../server/design-tokens.ts";
import type { RejectReason } from "../../../server/modules/references.ts";
import type { Locale } from "../i18n.ts";

export type Aspect = "layout" | "color" | "typography" | "components";
export const ASPECTS: Aspect[] = ["layout", "color", "typography", "components"];

type Instruction = { name: string; url: string; aspects: Aspect[]; withSelection: boolean };
type BuildInstruction = { name: string; url: string; aspects: Aspect[]; description: string };

// 照参考搭页面时，要求 AI 按「打磨」的设计变量约定生成变量文件，之后可以直接打磨。变量清单是给 AI 的技术约定，两种语言共用。
const TOKEN_LIST = DESIGN_TOKENS.map((t) => `- ${t.name}: ${t.meaning}`).join("\n");

// 「参考页面」工具窗的全部文案。两种语言同时补齐，类型会检查缺漏。
const en = {
	title: "Reference pages",
	tabSimilar: "Similar products",
	tabCurated: "Curated",
	pageType: "Page type",
	pasteLabel: "Paste a web address to add it as a reference",
	pastePlaceholder: "Paste a URL, e.g. linear.app",
	add: "Add",
	adding: "Opening…",
	pasteFailed: (reason: string) => `Couldn't use this page: ${reason.toLowerCase()}`,
	reasons: {
		invalid: "Not a web address",
		unreachable: "Couldn't open it",
		"http-error": "The site returned an error",
		"error-page": "It shows an error page",
		login: "Requires logging in",
		blank: "The page is empty",
	} satisfies Record<RejectReason, string>,
	findIntro: "The AI reads this project, works out what kind of product and page it is, then opens real pages from similar products for you to borrow from.",
	find: "Find similar products",
	findAgain: "Find again",
	reading: "Reading the project to work out what it is…",
	checking: (done: number, total: number) => `Opening and checking pages ${done}/${total}`,
	productLine: (kind: string, page: string) => `${kind} · ${page}`,
	found: (kept: number, dropped: number) => `${kept} pages${dropped ? `, ${dropped} dropped` : ""}`,
	noneKept: "None of the suggested pages could be opened. Try again, or paste an address you like.",
	findFailed: "Couldn't find similar products",
	retry: "Try again",
	openFull: (name: string) => `View ${name}`,
	fullPageLoading: "Capturing the whole page…",
	fullPageFailed: "Couldn't capture the whole page; showing the first screen",
	borrow: "Borrow its",
	aspects: { layout: "Layout", color: "Colors", typography: "Type hierarchy", components: "Component style" } satisfies Record<Aspect, string>,
	selectionOnly: (n: number) => `Only the ${n === 1 ? "element" : `${n} elements`} you circled will change`,
	useThis: "Use as reference",
	openInBrowser: "Open in browser",
	close: "Close",
	startTitle: "Start from a page you like",
	startHint: "Pick a reference and the AI builds your page in its layout, colors and type. Describe what you want to make to see similar products first.",
	describeLabel: "What do you want to make? (optional)",
	describePlaceholder: "e.g. a website for my specialty coffee shop",
	findForDescription: "Find similar",
	buildThis: "Build it like this",
	building: "The AI is building your page from the reference…",
	build: ({ name, url, aspects, description }: BuildInstruction) =>
		[
			`Build the first page of this project, using the attached page (${name}, ${url}) as the design reference.`,
			`What to build: ${description || "a page of the same kind as the reference, for our own product"}.`,
			`Follow its: ${aspects.map((a) => en.aspects[a].toLowerCase()).join(", ")}.`,
			"Write our own content; don't copy its text, images or logo.",
			`Put all design values in ${TOKENS_FILE}: define every variable below on :root, import that file first from the main stylesheet, and use var(...) for every font, color, radius, shadow and spacing instead of hard-coded values. Load web fonts with @import url(...) at the top of ${TOKENS_FILE}.`,
			TOKEN_LIST,
		].join("\n"),
	instruction: ({ name, url, aspects, withSelection }: Instruction) =>
		[
			`Use the attached page (${name}, ${url}) as a design reference to improve ${withSelection ? "the part of our page I circled" : "our page"}.`,
			`Borrow its: ${aspects.map((a) => en.aspects[a].toLowerCase()).join(", ")}.`,
			"Only borrow those design choices. Keep our own content, copy and brand; don't copy its text or images.",
			withSelection ? "Leave everything outside the circle unchanged." : "",
		]
			.filter(Boolean)
			.join("\n"),
};

const zh: typeof en = {
	title: "参考页面",
	tabSimilar: "同类产品",
	tabCurated: "精选",
	pageType: "页面类型",
	pasteLabel: "粘贴网址加入参考",
	pastePlaceholder: "粘贴网址，如 linear.app",
	add: "加入",
	adding: "正在打开…",
	pasteFailed: (reason) => `这个页面用不了：${reason}`,
	reasons: {
		invalid: "不是网址",
		unreachable: "打不开",
		"http-error": "网站返回了错误",
		"error-page": "显示的是错误页",
		login: "需要登录",
		blank: "页面是空的",
	},
	findIntro: "AI 会读这个项目，判断它是什么产品、什么页面，再打开同类产品的真实页面给你参考。",
	find: "找同类产品",
	findAgain: "重新查找",
	reading: "正在读项目，判断产品类型…",
	checking: (done, total) => `正在打开验证页面 ${done}/${total}`,
	productLine: (kind, page) => `${kind} · ${page}`,
	found: (kept, dropped) => `${kept} 个页面${dropped ? `，丢弃 ${dropped} 个` : ""}`,
	noneKept: "建议的页面都打不开。可以重新查找，或粘贴一个你喜欢的网址。",
	findFailed: "没找到同类产品",
	retry: "重试",
	openFull: (name) => `查看 ${name}`,
	fullPageLoading: "正在截取整页…",
	fullPageFailed: "整页截图失败，显示的是首屏",
	borrow: "参考它的",
	aspects: { layout: "版式布局", color: "配色", typography: "字体层级", components: "组件风格" },
	selectionOnly: (n) => `只改你圈选的 ${n} 个元素`,
	useThis: "参考这个",
	openInBrowser: "在浏览器打开",
	close: "关闭",
	startTitle: "先选一个参考定基调",
	startHint: "选一个喜欢的页面，AI 会照它的版式、配色和字体搭出你的页面。写下想做什么，可以先看同类产品。",
	describeLabel: "想做什么？（可选）",
	describePlaceholder: "如：精品咖啡店官网",
	findForDescription: "找同类",
	buildThis: "照这个做",
	building: "AI 正在照参考搭页面…",
	build: ({ name, url, aspects, description }) =>
		[
			`参考附图里的页面（${name}，${url}）搭出这个项目的第一个页面。`,
			`要做的是：${description || "和参考同类的页面，用于我们自己的产品"}。`,
			`参考它的：${aspects.map((a) => zh.aspects[a]).join("、")}。`,
			"内容用我们自己的，不照搬它的文字、图片和标志。",
			`所有设计取值放进 ${TOKENS_FILE}：在 :root 上定义下面每个变量，由主样式表最先引入这个文件；字体、颜色、圆角、阴影、间距一律用 var(...)，不写死数值。网页字体用 @import url(...) 写在 ${TOKENS_FILE} 顶部。`,
			TOKEN_LIST,
		].join("\n"),
	instruction: ({ name, url, aspects, withSelection }) =>
		[
			`参考附图里的页面（${name}，${url}）改进${withSelection ? "我圈选的部分" : "当前页面"}。`,
			`参考它的：${aspects.map((a) => zh.aspects[a]).join("、")}。`,
			"只借鉴这些方面的设计手法，保留我们自己的内容、文案和品牌，不照搬它的文字和图片。",
			withSelection ? "圈选以外的部分保持不变。" : "",
		]
			.filter(Boolean)
			.join("\n"),
};

export const STRINGS: Record<Locale, typeof en> = { en, zh };
