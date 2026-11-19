import { chromium } from "playwright";
import { type PageCapture, SNAPSHOT_ATTRS } from "./page-capture.ts";
import type { Point, Viewport } from "./protocol.ts";
import { locateInSource } from "./source-locator.ts";

export type CircledElement = { selector: string; html: string; text: string; sources: string[] };
export type AnnotationResult = { png: Buffer; elements: CircledElement[] };

const STROKE_COLOR = "#ef4444";

/** 在浏览器里执行：按快照里的标记还原弹窗、容器滚动和窗口滚动。 */
function restoreSnapshot({ attrs, scrollX, scrollY }: { attrs: typeof SNAPSHOT_ATTRS; scrollX: number; scrollY: number }) {
	for (const dialog of document.querySelectorAll<HTMLDialogElement>(`[${attrs.modal}]`)) {
		dialog.close();
		dialog.showModal();
	}
	for (const el of document.querySelectorAll<HTMLElement>(`[${attrs.popover}]`)) el.showPopover();
	for (const el of document.querySelectorAll(`[${attrs.scroll}]`)) {
		const [left, top] = el.getAttribute(attrs.scroll)!.split(",").map(Number);
		el.scrollTo({ left, top, behavior: "instant" });
	}
	window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
}

function drawStroke({ stroke, color, number }: { stroke: Point[]; color: string; number?: number }) {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("style", "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647");
	const line = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
	line.setAttribute("points", stroke.map(([x, y]) => `${x},${y}`).join(" "));
	line.setAttribute("style", `fill:none;stroke:${color};stroke-width:4;stroke-linejoin:round`);
	svg.append(line);
	if (number !== undefined) {
		const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
		label.setAttribute("x", String(Math.max(16, Math.min(...stroke.map(p => p[0])))));
		label.setAttribute("y", String(Math.max(24, Math.min(...stroke.map(p => p[1])))));
		label.setAttribute("style", `fill:${color};stroke:white;stroke-width:4;paint-order:stroke;font:bold 22px sans-serif`);
		label.textContent = String(number);
		svg.append(label);
	}
	// 放进最上层的弹窗里，否则会被顶层（top layer）的弹窗盖住。
	const modals = document.querySelectorAll("dialog:modal");
	(modals[modals.length - 1] ?? document.documentElement).append(svg);
}

type RenderOptions = { capture: PageCapture; viewport: Viewport; stroke: Point[]; projectDir: string; number?: number; circles?: { stroke: Point[]; number?: number }[] };

/** 用相同视口渲染用户画圈那一刻的页面快照并画上圈注；圈内元素来自用户的真实页面，补上源码位置。 */
export async function renderAnnotation({ capture, viewport, stroke, projectDir, number, circles }: RenderOptions): Promise<AnnotationResult> {
	// 每次单独启动无头浏览器（约 0.1 秒），不留常驻进程。
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
		const documentUrl = capture.href.split("#")[0];
		// 在原地址上提供快照，相对路径的样式、图片、字体照常从 dev server 加载。
		await page.route((url) => url.href === documentUrl, (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: capture.html }));
		await page.goto(capture.href, { waitUntil: "networkidle" });
		await page.evaluate(restoreSnapshot, { attrs: SNAPSHOT_ATTRS, scrollX: capture.scrollX, scrollY: capture.scrollY });
		for (const circle of circles ?? [{ stroke, number }]) await page.evaluate(drawStroke, { ...circle, color: STROKE_COLOR });
		const png = await page.screenshot({ type: "png" });
		const elements = await Promise.all(
			capture.elements.map(async ({ selector, html, text, ...hints }) => ({ selector, html, text, sources: await locateInSource(projectDir, hints) })),
		);
		return { png, elements };
	} finally {
		await browser.close();
	}
}
