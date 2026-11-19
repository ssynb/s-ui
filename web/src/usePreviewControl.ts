import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewAnnouncement, PreviewOp, PreviewOpReply } from "../../server/preview-ops.ts";
import { PREVIEW_OP_MESSAGE } from "../../server/protocol.ts";
import type { PageInspection, PreviewControl, TokenValues } from "./panels.ts";

const REPLY_TIMEOUT_MS = 15_000;

type Pending = { resolve: (result: unknown) => void; reject: (error: Error) => void };

/**
 * 面板操作预览页面的入口（PanelProps.preview）：经 PREVIEW_OP_MESSAGE 与预览里的桥接脚本通信。
 * 样式层与字体由桥接脚本记在预览页面里，页面刷新、热更新后自己重新注入；
 * 工作区刚打开时先清掉上一次留下的样式层，面板从干净的预览开始。
 */
export function usePreviewControl(frame: RefObject<HTMLIFrameElement | null>, previewUrl?: string): PreviewControl {
	const [ready, setReady] = useState(false);
	const [pageHref, setPageHref] = useState<string>();
	const readyRef = useRef(false);
	const pending = useRef(new Map<number, Pending>());
	const nextId = useRef(0);
	const cleared = useRef(false);

	const send = (op: PreviewOp) =>
		new Promise<unknown>((resolve, reject) => {
			const target = frame.current?.contentWindow;
			if (!previewUrl || !target) return reject(new Error("Preview is not ready"));
			const id = ++nextId.current;
			const timer = setTimeout(() => {
				pending.current.delete(id);
				reject(new Error("Preview did not respond"));
			}, REPLY_TIMEOUT_MS);
			pending.current.set(id, {
				resolve: (r) => (clearTimeout(timer), resolve(r)),
				reject: (e) => (clearTimeout(timer), reject(e)),
			});
			target.postMessage({ type: PREVIEW_OP_MESSAGE, id, op }, new URL(previewUrl).origin);
		});

	useEffect(() => {
		const setState = (value: boolean) => {
			readyRef.current = value;
			setReady(value);
		};
		setState(false);
		setPageHref(undefined);
		if (!previewUrl) return;
		const origin = new URL(previewUrl).origin;
		const becameReady = (href: unknown) => {
			if (typeof href === "string") setPageHref(href.split("#", 1)[0]);
			if (!cleared.current) {
				cleared.current = true;
				send({ name: "clearAll" }).then(() => setState(true), () => setState(false));
			} else setState(true);
		};
		const onMessage = (e: MessageEvent) => {
			if (e.origin !== origin || e.source !== frame.current?.contentWindow || e.data?.type !== PREVIEW_OP_MESSAGE) return;
			const data = e.data as PreviewAnnouncement | PreviewOpReply;
			if ("event" in data) {
				if (data.event === "ready") {
					if (data.href) becameReady(data.href);
					else send({ name: "ping" }).then(becameReady, () => {});
				}
				else if (data.event === "leaving") setState(false);
				else setPageHref(data.href);
				return;
			}
			const waiter = pending.current.get(data.id);
			pending.current.delete(data.id);
			if (data.ok) waiter?.resolve(data.result);
			else waiter?.reject(new Error(data.error));
		};
		addEventListener("message", onMessage);
		// 预览可能在这之前就已加载完、错过了 ready 通知：主动问一次，没回应就等它的 ready。
		send({ name: "ping" }).then(becameReady, () => {});
		return () => removeEventListener("message", onMessage);
	}, [previewUrl]);

	return useMemo(() => {
		const op = <T>(o: PreviewOp) => (readyRef.current ? (send(o) as Promise<T>) : Promise.reject(new Error("Preview is not ready")));
		return {
			ready,
			pageHref,
			applyLayer: (id, css, pageHref) => op<void>({ name: "applyLayer", id, css, pageHref }),
			clearLayer: (id) => op<void>({ name: "clearLayer", id }),
			clearAll: () => op<void>({ name: "clearAll" }),
			loadFonts: (urls) => op<void>({ name: "loadFonts", urls }),
			inspect: () => op<PageInspection>({ name: "inspect" }),
			readTokens: () => op<TokenValues>({ name: "readTokens" }),
		};
	}, [ready, pageHref, previewUrl]);
}
