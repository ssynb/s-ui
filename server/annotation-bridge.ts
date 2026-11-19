import type { PageCapture } from "./page-capture.ts";
import type { Point } from "./protocol.ts";

type Config = {
	origins: string[];
	capture: (stroke: Point[]) => PageCapture;
	captureMessage: string;
	pageMessage: string;
};

/** 注入预览执行，必须自包含。现场身份与视图签名让父页面丢弃过期采集，且不把旧圈画在滚动后的其他控件上。 */
export function installAnnotationBridge({ origins, capture, captureMessage, pageMessage }: Config) {
	const documentId = crypto.randomUUID();
	const scrollers = new Set<Element>();
	const elementIds = new WeakMap<Element, number>();
	let nextElementId = 0;
	const elementId = (el: Element) => {
		if (!elementIds.has(el)) elementIds.set(el, ++nextElementId);
		return elementIds.get(el)!;
	};
	const view = () => {
		const positions = [];
		for (const el of scrollers) {
			if (!el.isConnected) { scrollers.delete(el); continue; }
			if (el.scrollLeft || el.scrollTop) positions.push([elementId(el), el.scrollLeft, el.scrollTop]);
		}
		const top = [...document.querySelectorAll("dialog, [popover]")].filter(el => el.matches(":modal, :popover-open")).map(elementId);
		return JSON.stringify([innerWidth, innerHeight, scrollX, scrollY, positions, top]);
	};
	const announce = () => {
		for (const origin of origins) parent.postMessage({ type: pageMessage, documentId, href: location.href, view: view() }, origin);
	};
	addEventListener("scroll", event => {
		if (event.target instanceof Element) scrollers.add(event.target);
		announce();
	}, { capture: true, passive: true });
	addEventListener("resize", announce);
	addEventListener("toggle", announce, true);
	new MutationObserver(announce).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["open"] });
	addEventListener("hashchange", announce);
	addEventListener("popstate", announce);
	addEventListener("pagehide", () => {
		for (const origin of origins) parent.postMessage({ type: pageMessage, documentId, leaving: true }, origin);
	});
	for (const method of ["pushState", "replaceState"] as const) {
		const original = history[method];
		history[method] = (...args: Parameters<History["pushState"]>) => {
			original.apply(history, args);
			announce();
		};
	}
	addEventListener("message", event => {
		if (event.source !== parent || !origins.includes(event.origin)) return;
		if (event.data?.type === pageMessage) announce();
		if (event.data?.type !== captureMessage) return;
		parent.postMessage({ type: captureMessage, id: event.data.id, capture: { ...capture(event.data.stroke), documentId, view: view() } }, event.origin);
	});
	announce();
}
