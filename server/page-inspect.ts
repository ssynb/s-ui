// 识别预览页面里实际存在的组件（在用户的预览页面里执行，经预览桥接脚本调用）。
// 契约（冻结）：这里导出的类型。inspectPage 与 page-capture.ts 一样保持自包含。

/** 能识别的组件类别。 */
export type ComponentKind = "button" | "link" | "input" | "card" | "nav" | "heading" | "image" | "list" | "badge" | "table" | "dialog" | "footer";

export type ComponentInstance = { pageUrl: string; selector: string; sourceSelector: string; name: string; styles: Record<string, string> };

/** 一类组件在当前页面里的情况。 */
export type FoundComponent = {
	kind: ComponentKind;
	instances?: ComponentInstance[];
	/** 页面里这一类的实例数。 */
	count: number;
	/** 代表实例的选择器（唯一定位一个元素，可交给 AI 或做高亮）。 */
	selector: string;
	/** 尽量能选中这一类全部实例的选择器（优先共享 class），用于临时样式层覆盖。 */
	groupSelector: string;
	/** 代表实例的文字（截断），便于在面板里认出是哪个。 */
	text: string;
	/** 代表实例的关键计算样式：color、backgroundColor、borderRadius、padding、fontFamily、fontSize、fontWeight、boxShadow、border。 */
	styles: Record<string, string>;
};

export type PageInspection = {
	/** 识别时预览页面的地址。 */
	url: string;
	/** 按数量从多到少。 */
	components: FoundComponent[];
	/** 页面上实际用到的字体（计算后的 font-family，按使用多少排序）。 */
	fonts: string[];
	/** 页面上用得最多的颜色（文字与背景，rgb 字符串，按使用多少排序）。 */
	colors: string[];
};

/** 在预览页面里执行：识别组件、字体与颜色。必须自包含——它会被转成字符串注入页面。 */
export function inspectPage(): PageInspection {
	// 预览样式可跨刷新恢复；页面标记使旧文档/路由的选择器永远不匹配新页面。
	const root = document.documentElement;
	const scopeAttribute = "data-sui-polish-page";
	if (!root.hasAttribute(scopeAttribute)) root.setAttribute(scopeAttribute, Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join("-"));
	const scope = `html[${scopeAttribute}="${root.getAttribute(scopeAttribute)}"]`;
	const host = window as Window & { __suiPolishRouteWatch?: boolean };
	if (!host.__suiPolishRouteWatch) {
		host.__suiPolishRouteWatch = true;
		const invalidate = () => root.removeAttribute(scopeAttribute);
		for (const method of ["pushState", "replaceState"] as const) {
			const original = history[method].bind(history);
			history[method] = (...args: Parameters<History["pushState"]>) => {
				const before = location.href;
				original(...args);
				if (location.href !== before) invalidate();
			};
		}
		window.addEventListener("popstate", invalidate);
		window.addEventListener("hashchange", invalidate);
	}
	const TEXT_LIMIT = 40;
	const STYLE_KEYS = ["color", "backgroundColor", "borderRadius", "padding", "fontFamily", "fontSize", "fontWeight", "boxShadow", "border"] as const;
	const BUTTON_LIKE = "button, [role=button], input[type=submit], input[type=button], input[type=reset]";
	const QUERIES: [ComponentKind, string][] = [
		["nav", "nav, [role=navigation]"],
		["heading", "h1, h2, h3"],
		["input", "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=checkbox]):not([type=radio]), textarea, select"],
		["image", "img, picture, svg[role=img]"],
		["table", "table"],
		["dialog", "dialog, [role=dialog]"],
		["footer", "footer, [role=contentinfo]"],
		["list", "ul, ol"],
	];

	const visible = (el: Element) => {
		const r = el.getBoundingClientRect();
		const s = getComputedStyle(el);
		return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
	};
	const transparent = (c: string) => c === "transparent" || c === "rgba(0, 0, 0, 0)";
	const hasBox = (el: Element) => {
		const s = getComputedStyle(el);
		return !transparent(s.backgroundColor) || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== "none";
	};

	// 链接分两种：带底色或边框、像按钮的算按钮，其余算链接（导航里的不单独计）。
	const anchors = [...document.querySelectorAll("a[href]")].filter(visible);
	const buttonAnchors = anchors.filter((a) => hasBox(a) && parseFloat(getComputedStyle(a).paddingLeft) >= 6);
	const groups = new Map<ComponentKind, Element[]>();
	groups.set("button", [...[...document.querySelectorAll(BUTTON_LIKE)].filter(visible), ...buttonAnchors]);
	groups.set("link", anchors.filter((a) => !buttonAnchors.includes(a) && !a.closest("nav, [role=navigation], footer")));
	for (const [kind, query] of QUERIES) {
		let found = [...document.querySelectorAll(query)].filter(visible);
		if (kind === "list") found = found.filter((l) => l.children.length >= 3 && !l.closest("nav, footer"));
		if (kind === "image") found = found.filter((i) => i.getBoundingClientRect().width >= 24);
		groups.set(kind, found);
	}
	// 卡片：有边框、阴影或底色的圆角块，够大、含文字，且同样的块不止一个。
	const cardCandidates = [...document.querySelectorAll("div, article, li, section, a")].filter((el) => {
		const r = el.getBoundingClientRect();
		const s = getComputedStyle(el);
		return visible(el) && hasBox(el) && parseFloat(s.borderTopLeftRadius) > 0 && r.width >= 120 && r.height >= 80 && (el.textContent ?? "").trim().length > 0 && !groups.get("button")!.includes(el);
	});
	// 同一种卡片：标签相同，且共用至少一个 class（常见写法是基础 class 加变体 class）；都没有 class 时也算。
	const sameShape = (a: Element, b: Element) =>
		a.tagName === b.tagName && (a.classList.length === 0 ? b.classList.length === 0 : [...a.classList].some((c) => b.classList.contains(c)));
	groups.set(
		"card",
		cardCandidates.filter((el) => !cardCandidates.some((o) => o !== el && o.contains(el)) && cardCandidates.some((o) => o !== el && sameShape(o, el))),
	);
	// 徽标：短文字、带底色的小圆角行内块。
	groups.set(
		"badge",
		[...document.querySelectorAll("span, small, strong, em, mark")].filter((el) => {
			const r = el.getBoundingClientRect();
			const text = (el.textContent ?? "").trim();
			return visible(el) && text.length > 0 && text.length <= 20 && r.height < 32 && !transparent(getComputedStyle(el).backgroundColor) && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0;
		}),
	);

	const selectorOf = (el: Element) => {
		const parts: string[] = [];
		for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
			if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
				parts.unshift(`#${CSS.escape(node.id)}`);
				break;
			}
			const tag = node.tagName.toLowerCase();
			const parent: Element | null = node.parentElement;
			const siblings = parent ? [...parent.children].filter((s) => s.tagName === node!.tagName) : [];
			parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag);
		}
		return parts.join(" > ");
	};
	const baseQuery = new Map<ComponentKind, string>([["button", BUTTON_LIKE], ...QUERIES]);
	// 成组选择器：优先用全部实例共有的 class，其次单一标签或这一类的基础选择器（恰好选中这些实例时），最后退回列出各实例。
	const groupSelectorOf = (els: Element[], kind: ComponentKind) => {
		const shared = [...els[0]!.classList].filter((c) => els.every((e) => e.classList.contains(c)));
		const tags = new Set(els.map((e) => e.tagName.toLowerCase()));
		if (shared.length) {
			const candidate = (tags.size === 1 ? [...tags][0] : "") + shared.map((c) => `.${CSS.escape(c)}`).join("");
			if ([...document.querySelectorAll(candidate)].every(e => els.includes(e)) && document.querySelectorAll(candidate).length === els.length) return candidate;
		}
		if (tags.size === 1 && kind !== "card" && kind !== "badge" && kind !== "link") {
			const tag = [...tags][0]!;
			if ([...document.querySelectorAll(tag)].every(e => els.includes(e)) && document.querySelectorAll(tag).length === els.length) return tag;
		}
		const base = baseQuery.get(kind);
		if (base && [...document.querySelectorAll(base)].every(e => els.includes(e)) && document.querySelectorAll(base).length === els.length) return base;
		return els.map(selectorOf).join(", ");
	};

	const components: FoundComponent[] = [];
	for (const [kind, els] of groups) {
		if (!els.length) continue;
		const first = els[0]!;
		const s = getComputedStyle(first);
		const instances = els.map((el, index) => {
			const sourceSelector = selectorOf(el);
			const label = el.getAttribute("aria-label") || (el as HTMLInputElement).labels?.[0]?.textContent || el.getAttribute("alt") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || (el as HTMLInputElement).value || el.tagName.toLowerCase();
			const computed = getComputedStyle(el);
			return { pageUrl: location.href, selector: `${scope} ${sourceSelector}`, sourceSelector, name: `${label.trim().replace(/\s+/g, " ").slice(0, TEXT_LIMIT)} · ${index + 1}`, styles: Object.fromEntries(STYLE_KEYS.map(k => [k, computed[k]])) };
		});
		components.push({
			instances,
			kind,
			count: els.length,
			selector: selectorOf(first),
			groupSelector: groupSelectorOf(els, kind),
			text: ((first as HTMLElement).innerText ?? first.getAttribute("placeholder") ?? "").trim().replace(/\s+/g, " ").slice(0, TEXT_LIMIT) || (first.getAttribute("placeholder") ?? ""),
			styles: Object.fromEntries(STYLE_KEYS.map((k) => [k, s[k]])),
		});
	}
	components.sort((a, b) => b.count - a.count);

	// 字体与颜色按出现次数排序：只算直接含文字的元素，背景色算所有可见的块。
	const tally = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
	const fonts = new Map<string, number>();
	const colors = new Map<string, number>();
	for (const el of document.body.querySelectorAll("*")) {
		if (!visible(el)) continue;
		const s = getComputedStyle(el);
		const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
		if (hasText) {
			tally(fonts, s.fontFamily);
			tally(colors, s.color);
		}
		if (!transparent(s.backgroundColor)) tally(colors, s.backgroundColor);
	}
	const ranked = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);

	return { url: location.href, components, fonts: ranked(fonts), colors: ranked(colors) };
}
