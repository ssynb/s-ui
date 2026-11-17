import type { Locale } from "../i18n.ts";

import type { RejectReason } from "../../../server/modules/references.ts";

export type Aspect = "layout" | "color" | "typography" | "components";
export const ASPECTS: Aspect[] = ["layout", "color", "typography", "components"];

type Instruction = { name: string; url: string; aspects: Aspect[]; withSelection: boolean };

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
