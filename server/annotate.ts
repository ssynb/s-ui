import { chromium } from "playwright";
import type { Annotation, Point } from "./protocol.ts";
import { locateInSource } from "./source-locator.ts";

export type CircledElement = { selector: string; html: string; text: string; sources: string[] };
export type AnnotationCapture = { png: Buffer; elements: CircledElement[] };

const STROKE_COLOR = "#ef4444";
const MAX_ELEMENTS = 8;
const HTML_LIMIT = 600;

/** 在浏览器里执行：找出圈内的元素。必须自包含，Playwright 会序列化它。 */
function findCircledElements({ stroke, maxElements, htmlLimit }: { stroke: Point[]; maxElements: number; htmlLimit: number }) {
	const inside = (x: number, y: number) => {
		let hit = false;
		for (let i = 0, j = stroke.length - 1; i < stroke.length; j = i++) {
			const [xi, yi] = stroke[i]!;
			const [xj, yj] = stroke[j]!;
			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
		}
		return hit;
	};
	const xs = stroke.map((p) => p[0]);
	const ys = stroke.map((p) => p[1]);
	const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
	const step = Math.max(4, Math.min(box.right - box.left, box.bottom - box.top) / 12);

	const hits = new Set<Element>();
	for (let x = box.left; x <= box.right; x += step) {
		for (let y = box.top; y <= box.bottom; y += step) {
			if (!inside(x, y)) continue;
			for (const el of document.elementsFromPoint(x, y)) hits.add(el);
		}
	}
	hits.delete(document.documentElement);
	hits.delete(document.body);

	const enclosed = (el: Element) => {
		const r = el.getBoundingClientRect();
		const corners: [number, number][] = [
			[r.left, r.top],
			[r.right, r.top],
			[r.left, r.bottom],
			[r.right, r.bottom],
		];
		return r.width > 0 && r.height > 0 && corners.every(([x, y]) => inside(x, y));
	};
	let picked = [...hits].filter(enclosed);
	// 只留最外层：外层的 outerHTML 已经包含内层。
	picked = picked.filter((el) => !picked.some((other) => other !== el && other.contains(el)));
	if (picked.length === 0) {
		const cx = (box.left + box.right) / 2;
		const cy = (box.top + box.bottom) / 2;
		const deepest = document.elementsFromPoint(cx, cy).find((el) => el !== document.documentElement && el !== document.body);
		if (deepest) picked = [deepest];
	}

	const selectorOf = (el: Element) => {
		const parts: string[] = [];
		for (let node: Element | null = el; node && node !== document.body && parts.length < 4; node = node.parentElement) {
			if (node.id) {
				parts.unshift(`${node.tagName.toLowerCase()}#${CSS.escape(node.id)}`);
				break;
			}
			const classes = [...node.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join("");
			const siblings = node.parentElement ? [...node.parentElement.children].filter((s) => s.tagName === node!.tagName) : [];
			const nth = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : "";
			parts.unshift(`${node.tagName.toLowerCase()}${classes}${nth}`);
		}
		return parts.join(" > ");
	};
	const ownText = (el: Element) =>
		[...el.childNodes]
			.filter((n) => n.nodeType === Node.TEXT_NODE)
			.map((n) => n.textContent!.trim())
			.find(Boolean) ?? "";

	return picked.slice(0, maxElements).map((el) => ({
		selector: selectorOf(el),
		html: el.outerHTML.slice(0, htmlLimit),
		text: ((el as HTMLElement).innerText ?? "").trim().slice(0, 120),
		id: el.id,
		classes: [...el.classList],
		ownText: ownText(el) || ((el as HTMLElement).innerText ?? "").trim().split("\n")[0]!,
	}));
}

function drawStroke({ stroke, color }: { stroke: Point[]; color: string }) {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("style", "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647");
	const line = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
	line.setAttribute("points", stroke.map(([x, y]) => `${x},${y}`).join(" "));
	line.setAttribute("style", `fill:none;stroke:${color};stroke-width:4;stroke-linejoin:round`);
	svg.append(line);
	document.documentElement.append(svg);
}

/** 用与预览相同的视口打开页面，找出圈内元素并截一张带圈注的图。 */
export async function captureAnnotation({ url, projectDir, ...annotation }: Annotation & { url: string; projectDir: string }): Promise<AnnotationCapture> {
	// 每次单独启动无头浏览器（约 0.1 秒），不留常驻进程。
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: annotation.viewport, deviceScaleFactor: 1 });
		await page.goto(url, { waitUntil: "networkidle" });
		const found = await page.evaluate(findCircledElements, { stroke: annotation.stroke, maxElements: MAX_ELEMENTS, htmlLimit: HTML_LIMIT });
		await page.evaluate(drawStroke, { stroke: annotation.stroke, color: STROKE_COLOR });
		const png = await page.screenshot({ type: "png" });
		const elements = await Promise.all(
			found.map(async ({ selector, html, text, ...hints }) => ({ selector, html, text, sources: await locateInSource(projectDir, hints) })),
		);
		return { png, elements };
	} finally {
		await browser.close();
	}
}
