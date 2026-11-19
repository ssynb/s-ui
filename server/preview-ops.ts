// 预览页面里的“预览操作”处理（经预览代理注入，由工作台经 PREVIEW_OP_MESSAGE 调用）：
// 临时样式层、网页字体、识别组件、读设计变量。installPreviewOps 必须自包含——它会被转成字符串注入页面。
import type { PageInspection } from "./page-inspect.ts";
import type { StyleInspection } from "./modules/style-scope.ts";

/** 工作台发给预览的操作。 */
export type PreviewOp =
	| { name: "ping" }
	| { name: "applyLayer"; id: string; css: string; pageHref?: string }
	| { name: "clearLayer"; id: string }
	| { name: "clearAll" }
	| { name: "loadFonts"; urls: string[] }
	| { name: "inspect" }
	| { name: "readTokens" };

/** 工作台 → 预览：{ type, id, op }；预览 → 工作台：回复 { type, id, ok, result | error }，或通知 { type, event }。 */
export type PreviewOpRequest = { type: string; id: number; op: PreviewOp };
export type PreviewOpReply = { type: string; id: number; ok: true; result: unknown } | { type: string; id: number; ok: false; error: string };
/** ready：桥接已就绪（页面每次加载一次）；leaving：页面即将卸载（刷新、跳转）。 */
export type PreviewAnnouncement = { type: string; event: "ready" | "leaving"; href?: string };

type Config = { styleLayer: string; allowed: string[]; type: string; tokenNames: string[]; inspect: () => PageInspection };

export function installPreviewOps({ allowed, type, tokenNames, inspect, styleLayer }: Config) {
	const STORE = "s-ui:preview-layers";
	const LAYER = "data-sui-layer";
	const FONT = "data-sui-font";
	const FONT_TIMEOUT_MS = 5000;
	type Saved = { layers: [id: string, css: string, pageHref?: string][]; fonts: string[] };

	const load = (): Saved => {
		try {
			return JSON.parse(sessionStorage.getItem(STORE) ?? "") as Saved;
		} catch {
			return { layers: [], fonts: [] };
		}
	};
	const routeOf = (href: string) => href.split("#", 1)[0]!;
	let currentRoute = routeOf(location.href);
	let appOrigin = allowed.find((origin) => document.referrer.startsWith(`${origin}/`));
	const announce = (event: PreviewAnnouncement["event"]) => {
		if (parent === window) return;
		if (appOrigin) parent.postMessage({ type, event, href: event === "leaving" ? undefined : currentRoute }, appOrigin);
		else parent.postMessage({ type, event }, "*");
	};
	const isScoped = (id: string) => id === styleLayer || id.startsWith(`${styleLayer}:`);
	let stylePageId = crypto.randomUUID();
	let pageUrl = location.href;
	let active = true;
	let saved = load();
	// Page-local styles must not be restored, including unscoped entries in existing storage.
	saved.layers = saved.layers.filter(([id]) => !isScoped(id));
	const persist = () => sessionStorage.setItem(STORE, JSON.stringify({ ...saved, layers: saved.layers.filter(([id]) => !isScoped(id)) }));
	persist();

	const layerElements = () => [...document.querySelectorAll<HTMLStyleElement>(`style[${LAYER}]`)];
	// 样式层放在 <body> 之后、文档最末：比页面里任何 <head>/<body> 里的样式都晚，同优先级时覆盖它们。
	const keepOnTop = () => {
		const root = document.documentElement;
		const children = [...root.children];
		const first = children.findIndex((c) => c.hasAttribute(LAYER));
		if (first >= 0 && children.slice(first).some((c) => !c.hasAttribute(LAYER))) {
			for (const el of layerElements()) root.append(el);
		}
	};
	const renderLayers = () => {
		const existing = new Map(layerElements().map((el) => [el.getAttribute(LAYER)!, el]));
		for (const [id, css] of saved.layers) {
			const el = existing.get(id) ?? document.createElement("style");
			el.setAttribute(LAYER, id);
			if (el.textContent !== css) el.textContent = css;
			document.documentElement.append(el);
			existing.delete(id);
		}
		for (const el of existing.values()) el.remove();
	};
	const renderFonts = () => {
		const existing = new Map([...document.querySelectorAll<HTMLLinkElement>(`link[${FONT}]`)].map((el) => [el.getAttribute("href")!, el]));
		const added: HTMLLinkElement[] = [];
		for (const href of saved.fonts) {
			if (existing.delete(href)) continue;
			const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
			link.setAttribute(FONT, "");
			document.head.append(link);
			added.push(link);
		}
		for (const el of existing.values()) el.remove();
		return added;
	};
	const loaded = (link: HTMLLinkElement) =>
		new Promise<void>((resolve) => {
			link.addEventListener("load", () => resolve(), { once: true });
			link.addEventListener("error", () => resolve(), { once: true });
			setTimeout(resolve, FONT_TIMEOUT_MS);
		});

	const run = async (op: { name: string; [key: string]: unknown }): Promise<unknown> => {
		switch (op.name) {
			case "ping":
				return location.href;
			case "applyLayer": {
				const id = String(op.id);
				if (isScoped(id) && (!active || id !== `${styleLayer}:${stylePageId}`)) throw new Error("The page changed; generate a new style preview");
				const pageHref = typeof op.pageHref === "string" ? routeOf(op.pageHref) : undefined;
				if (pageHref !== undefined && pageHref !== currentRoute) throw new Error("Preview navigated");
				const layer: Saved["layers"][number] = pageHref === undefined ? [id, String(op.css)] : [id, String(op.css), pageHref];
				const at = saved.layers.findIndex(([key]) => key === id);
				if (at >= 0) saved.layers[at] = layer;
				else saved.layers.push(layer);
				break;
			}
			case "clearLayer":
				saved.layers = saved.layers.filter(([layer]) => layer !== op.id);
				break;
			case "clearAll":
				saved = { layers: [], fonts: [] };
				break;
			case "loadFonts": {
				saved.fonts = [...new Set([...saved.fonts, ...(op.urls as string[])])];
				persist();
				await Promise.all(renderFonts().map(loaded));
				return undefined;
			}
			case "inspect":
				return { ...inspect(), stylePageId } satisfies StyleInspection;
			case "readTokens": {
				const style = getComputedStyle(document.documentElement);
				return Object.fromEntries(tokenNames.map((name) => [name, style.getPropertyValue(name).trim()]).filter(([, value]) => value));
			}
			default:
				throw new Error(`Unknown preview op: ${op.name}`);
		}
		persist();
		renderLayers();
		renderFonts();
		return undefined;
	};

	const pruneLayers = () => {
		const kept = saved.layers.filter(([, , href]) => !href || href === currentRoute);
		if (kept.length === saved.layers.length) return;
		saved.layers = kept;
		persist();
		renderLayers();
	};

	pruneLayers();
	renderLayers();
	renderFonts();
	new MutationObserver(keepOnTop).observe(document.documentElement, { childList: true });

	addEventListener("message", async (e) => {
		if (e.source !== parent || !allowed.includes(e.origin) || e.data?.type !== type || e.data.event) return;
		appOrigin = e.origin;
		const { id, op } = e.data;
		try {
			parent.postMessage({ type, id, ok: true, result: await run(op) }, e.origin);
		} catch (error) {
			parent.postMessage({ type, id, ok: false, error: (error as Error).message }, e.origin);
		}
	});
	const leave = () => {
		active = false;
		stylePageId = crypto.randomUUID();
		saved.layers = saved.layers.filter(([id]) => !isScoped(id));
		persist();
		renderLayers();
		announce("leaving");
	};
	const entered = () => {
		pageUrl = location.href;
		currentRoute = routeOf(pageUrl);
		pruneLayers();
		active = true;
		announce("ready");
	};
	const changed = () => { if (location.href !== pageUrl) { leave(); entered(); } };
	const navigation = (window as Window & { navigation?: EventTarget }).navigation;
	if (navigation) navigation.addEventListener("currententrychange", changed);
	else {
		for (const method of ["pushState", "replaceState"] as const) {
			const original = history[method];
			history[method] = function (...args: Parameters<History[typeof method]>) {
				const result = original.apply(this, args);
				changed();
				return result;
			};
		}
		addEventListener("popstate", changed);
		addEventListener("hashchange", () => { if (location.href !== pageUrl) changed(); });
	}
	addEventListener("pagehide", leave);
	addEventListener("pageshow", (event) => { if (event.persisted) entered(); });
	entered();
}
