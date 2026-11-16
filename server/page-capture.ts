// 在用户的预览页面里执行（由预览桥接脚本注入）：从用户此刻看到的真实页面里找圈内元素，并拍下 DOM 现场。
// capturePage 必须自包含——它会被转成字符串注入页面，不能引用模块里的其他东西。

type Point = [x: number, y: number];

export type FoundElement = { selector: string; html: string; text: string; id: string; classes: string[]; ownText: string };

/** 画圈那一刻的页面现场：地址、窗口滚动、DOM 快照（含表单值、容器滚动、弹窗状态）和圈内元素。 */
export type PageCapture = { href: string; scrollX: number; scrollY: number; html: string; elements: FoundElement[] };

/** 快照里的状态标记，渲染端据此还原。 */
export const SNAPSHOT_ATTRS = { scroll: "data-s-ui-scroll", modal: "data-s-ui-modal", popover: "data-s-ui-popover" } as const;

export function capturePage(stroke: Point[]): PageCapture {
	const MAX_ELEMENTS = 8;
	const HTML_LIMIT = 600;
	const ATTRS = { scroll: "data-s-ui-scroll", modal: "data-s-ui-modal", popover: "data-s-ui-popover" }; // = SNAPSHOT_ATTRS

	const inside = (x: number, y: number) => {
		let hit = false;
		for (let i = 0, j = stroke.length - 1; i < stroke.length; j = i++) {
			const [xi, yi] = stroke[i]!;
			const [xj, yj] = stroke[j]!;
			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
		}
		return hit;
	};

	function findElements(): FoundElement[] {
		const xs = stroke.map((p) => p[0]);
		const ys = stroke.map((p) => p[1]);
		const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
		const step = Math.max(4, Math.min(box.right - box.left, box.bottom - box.top) / 12);
		const isPage = (el: Element) => el === document.documentElement || el === document.body;

		const hits = new Set<Element>();
		for (let x = box.left; x <= box.right; x += step) {
			for (let y = box.top; y <= box.bottom; y += step) {
				if (!inside(x, y)) continue;
				// 只取每个点最上层的那一叠：被弹窗等遮住的元素不算圈中。
				for (const el of document.elementsFromPoint(x, y)) if (!isPage(el)) hits.add(el);
			}
		}
		const topmost = new Set<Element>();
		for (const el of hits) {
			const r = el.getBoundingClientRect();
			const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
			if (top && (el === top || el.contains(top))) topmost.add(el);
		}

		const enclosed = (el: Element) => {
			const r = el.getBoundingClientRect();
			const corners: Point[] = [
				[r.left, r.top],
				[r.right, r.top],
				[r.left, r.bottom],
				[r.right, r.bottom],
			];
			return r.width > 0 && r.height > 0 && corners.every(([x, y]) => inside(x, y));
		};
		let picked = [...topmost].filter(enclosed);
		// 只留最外层：外层的 outerHTML 已经包含内层。
		picked = picked.filter((el) => !picked.some((other) => other !== el && other.contains(el)));
		if (picked.length === 0) {
			const deepest = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
			if (deepest && !isPage(deepest)) picked = [deepest];
		}

		const selectorOf = (el: Element) => {
			const parts: string[] = [];
			for (let node: Element | null = el; node && node !== document.body && parts.length < 4; node = node.parentElement) {
				if (node.id) {
					parts.unshift(`${node.tagName.toLowerCase()}#${CSS.escape(node.id)}`);
					break;
				}
				const classes = [...node.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join("");
				const tag = node.tagName;
				const siblings = node.parentElement ? [...node.parentElement.children].filter((s) => s.tagName === tag) : [];
				const nth = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : "";
				parts.unshift(`${tag.toLowerCase()}${classes}${nth}`);
			}
			return parts.join(" > ");
		};
		const textOf = (el: Element) => ((el as HTMLElement).innerText ?? "").trim();
		const ownText = (el: Element) =>
			[...el.childNodes]
				.filter((n) => n.nodeType === Node.TEXT_NODE)
				.map((n) => n.textContent!.trim())
				.find(Boolean) ?? textOf(el).split("\n")[0]!;

		return picked.slice(0, MAX_ELEMENTS).map((el) => ({
			selector: selectorOf(el),
			html: el.outerHTML.slice(0, HTML_LIMIT),
			text: textOf(el).slice(0, 120),
			id: el.id,
			classes: [...el.classList],
			ownText: ownText(el),
		}));
	}

	function snapshot() {
		const marked: Element[] = [];
		const mark = (el: Element, attr: string, value = "") => {
			el.setAttribute(attr, value);
			marked.push(el);
		};
		for (const el of document.querySelectorAll("*")) {
			if (el.scrollLeft || el.scrollTop) mark(el, ATTRS.scroll, `${el.scrollLeft},${el.scrollTop}`);
			if (el.matches("dialog:modal")) mark(el, ATTRS.modal);
			if (el.matches(":popover-open")) mark(el, ATTRS.popover);
		}
		const clone = document.documentElement.cloneNode(true) as HTMLElement;
		for (const el of marked) for (const attr of Object.values(ATTRS)) el.removeAttribute(attr);

		const pairs = (selector: string) => {
			const live = [...document.querySelectorAll(selector)];
			const copy = [...clone.querySelectorAll(selector)];
			return live.map((el, i) => [el, copy[i]!] as const);
		};
		for (const [live, copy] of pairs("input, textarea, select")) {
			if (live instanceof HTMLInputElement && (live.type === "checkbox" || live.type === "radio")) copy.toggleAttribute("checked", live.checked);
			else if (live instanceof HTMLTextAreaElement) copy.textContent = live.value;
			else if (live instanceof HTMLSelectElement) [...live.options].forEach((o, i) => copy.querySelectorAll("option")[i]?.toggleAttribute("selected", o.selected));
			else copy.setAttribute("value", (live as HTMLInputElement).value);
		}
		// 运行时用 insertRule 加的样式（CSS-in-JS）不在 <style> 文本里，按 CSSOM 重写。
		for (const [live, copy] of pairs("style")) {
			const sheet = (live as HTMLStyleElement).sheet;
			if (sheet) copy.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
		}
		for (const sheet of document.adoptedStyleSheets) {
			const style = document.createElement("style");
			style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
			clone.querySelector("head")?.append(style);
		}
		for (const [live, copy] of pairs("canvas")) {
			try {
				const img = document.createElement("img");
				img.src = (live as HTMLCanvasElement).toDataURL();
				img.setAttribute("style", (live as HTMLElement).getAttribute("style") ?? "");
				img.className = live.className;
				copy.replaceWith(img);
			} catch (error) {
				// 跨源污染的画布不允许读取像素，快照里只能留空白画布。
				if ((error as DOMException).name !== "SecurityError") throw error;
			}
		}
		// 快照只用于还原画面，去掉脚本，避免应用重新初始化覆盖现场。
		for (const script of clone.querySelectorAll("script")) script.remove();
		return `<!doctype html>\n${clone.outerHTML}`;
	}

	const elements = findElements();
	return { href: location.href, scrollX, scrollY, html: snapshot(), elements };
}
