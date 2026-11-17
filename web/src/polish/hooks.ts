import { useCallback, useEffect, useRef, useState } from "react";
import type { OrganizeProgress, OrganizeResult, PageInspection, PanelProps, PolishApi, PolishStatus, PreviewControl } from "../panels.ts";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 让预览里的临时样式层与字体跟上 layers / fonts：只注入变化的层、清掉不再需要的层，按顺序执行不交错。
 * 预览重新就绪（或面板重新挂载）时已注入的记录作废，全部重新注入。
 */
export function usePreviewSync(preview: PreviewControl, layers: Map<string, string>, fonts: string[]) {
	const [error, setError] = useState<string>();
	/** 每完成一次同步加一：之后读到的页面已带上当前的临时样式。 */
	const [synced, setSynced] = useState(0);
	const applied = useRef(new Map<string, string>());
	const loadedFonts = useRef(new Set<string>());
	const queue = useRef(Promise.resolve());
	const latest = useRef({ preview, layers, fonts });
	latest.current = { preview, layers, fonts };
	const key = JSON.stringify([[...layers], fonts]);

	useEffect(() => {
		if (!preview.ready) {
			applied.current = new Map();
			loadedFonts.current = new Set();
			return;
		}
		queue.current = queue.current.then(async () => {
			const { preview: control, layers: want, fonts: wantFonts } = latest.current;
			try {
				const newFonts = wantFonts.filter((url) => !loadedFonts.current.has(url));
				if (newFonts.length) {
					await control.loadFonts(newFonts);
					for (const url of newFonts) loadedFonts.current.add(url);
				}
				for (const [id, css] of want) {
					if (applied.current.get(id) === css) continue;
					await control.applyLayer(id, css);
					applied.current.set(id, css);
				}
				for (const id of [...applied.current.keys()]) {
					if (want.has(id)) continue;
					await control.clearLayer(id);
					applied.current.delete(id);
				}
				setError(undefined);
				setSynced((n) => n + 1);
			} catch (e) {
				setError(errorText(e));
			}
		});
	}, [preview.ready, key]);

	/** 清掉预览里的全部临时样式与字体（全部还原）。 */
	const clearAll = useCallback(async () => {
		await latest.current.preview.clearAll();
		applied.current = new Map();
		loadedFonts.current = new Set();
	}, []);

	return { error, clearAll, synced };
}

type StatusState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; status: PolishStatus };
type OrganizeState = { state: "idle" } | { state: "running"; progress: OrganizeProgress[] } | { state: "error"; message: string } | { state: "done"; result: OrganizeResult };

/** 设计变量文件的状态，以及一次性的“整理”。 */
export function usePolishStatus(callModule: PanelProps["callModule"]) {
	const [status, setStatus] = useState<StatusState>({ state: "loading" });
	const [organize, setOrganize] = useState<OrganizeState>({ state: "idle" });

	const load = useCallback(() => {
		setStatus({ state: "loading" });
		callModule<PolishApi, "status">("polish", "status", {}).then(
			(s) => setStatus({ state: "ready", status: s }),
			(e) => setStatus({ state: "error", message: errorText(e) }),
		);
	}, [callModule]);

	useEffect(load, [load]);

	const runOrganize = useCallback(async () => {
		setOrganize({ state: "running", progress: [] });
		try {
			const result = await callModule<PolishApi, "organize">("polish", "organize", {}, {
				onProgress: (data) => setOrganize((o) => (o.state === "running" ? { state: "running", progress: [...o.progress, data as OrganizeProgress] } : o)),
			});
			setOrganize({ state: "done", result });
			setStatus({ state: "ready", status: result });
		} catch (e) {
			setOrganize({ state: "error", message: errorText(e) });
		}
	}, [callModule]);

	return { status, setStatus, load, organize, runOrganize };
}

/** 识别预览页面里的组件；预览就绪时自动识别一次，可手动重新识别（识别中保留上一次结果，试用样式不闪）。run 返回这次的结果，失败时为空（错误在 error 里）。 */
export function useInspection(preview: PreviewControl) {
	const [inspection, setInspection] = useState<PageInspection>();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();
	const control = useRef(preview);
	control.current = preview;

	const run = useCallback(() => {
		setLoading(true);
		return control.current.inspect().then(
			(result) => {
				setInspection(result);
				setError(undefined);
				return result;
			},
			(e) => {
				setError(errorText(e));
				return undefined;
			},
		).finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		if (preview.ready) void run();
	}, [preview.ready, run]);

	return { inspection, loading, error, run };
}
