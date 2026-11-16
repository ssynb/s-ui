import { useRef, useState } from "react";
import { type Annotation, PAGE_STATE_MESSAGE, type PageState, type Point } from "../../server/protocol.ts";
import type { T } from "./i18n.ts";
import type { Preview as PreviewState } from "./useWorkspace.ts";

const MIN_STROKE_POINTS = 3;
const PAGE_STATE_TIMEOUT_MS = 2000;

type Stroke = Omit<Annotation, "page">;

/** 向预览里注入的桥接脚本询问当前地址和滚动位置（iframe 跨源，读不到）。 */
function requestPageState(frame: HTMLIFrameElement, previewUrl: string) {
	const id = crypto.randomUUID();
	return new Promise<PageState>((resolve, reject) => {
		const timer = setTimeout(() => {
			removeEventListener("message", onMessage);
			reject(new Error("page state timeout"));
		}, PAGE_STATE_TIMEOUT_MS);
		function onMessage(e: MessageEvent) {
			if (e.source !== frame.contentWindow || e.data?.type !== PAGE_STATE_MESSAGE || e.data.id !== id) return;
			clearTimeout(timer);
			removeEventListener("message", onMessage);
			resolve(e.data.page);
		}
		addEventListener("message", onMessage);
		frame.contentWindow!.postMessage({ type: PAGE_STATE_MESSAGE, id }, new URL(previewUrl).origin);
	});
}

function statusText(t: T, preview?: PreviewState) {
	switch (preview?.state) {
		case undefined:
			return t.noFolder;
		case "empty":
			return t.previewEmpty;
		case "installing":
			return t.previewInstalling;
		case "starting":
			return t.previewStarting;
		case "error":
			return t.previewError;
		case "stopped":
			return t.previewStopped;
		case "ready":
			return "";
	}
}

/** 画圈覆盖层：在 iframe 上方记录一笔闭合手绘路径，松手后附一句话发出。 */
function AnnotationLayer({ t, onSubmit, onCancel }: { t: T; onSubmit: (text: string, a: Stroke) => void; onCancel: () => void }) {
	const layer = useRef<HTMLDivElement>(null);
	const [stroke, setStroke] = useState<Point[]>([]);
	const [drawing, setDrawing] = useState(false);
	const [text, setText] = useState("");
	const done = !drawing && stroke.length >= MIN_STROKE_POINTS;

	const pointOf = (e: React.PointerEvent): Point => {
		const r = layer.current!.getBoundingClientRect();
		return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
	};
	const submit = () => {
		const { width, height } = layer.current!.getBoundingClientRect();
		onSubmit(text.trim(), { stroke, viewport: { width: Math.round(width), height: Math.round(height) } });
	};
	const [maxX, maxY] = stroke.reduce(([x, y], [px, py]) => [Math.max(x, px), Math.max(y, py)], [0, 0]);

	return (
		<div
			ref={layer}
			className="absolute inset-0 cursor-crosshair touch-none"
			onPointerDown={(e) => {
				if (done) return;
				e.currentTarget.setPointerCapture(e.pointerId);
				setDrawing(true);
				setStroke([pointOf(e)]);
			}}
			onPointerMove={(e) => drawing && setStroke((s) => [...s, pointOf(e)])}
			onPointerUp={() => setDrawing(false)}
		>
			<svg className="pointer-events-none absolute inset-0 h-full w-full">
				<polygon points={stroke.map((p) => p.join(",")).join(" ")} fill="rgba(239,68,68,0.08)" stroke="#ef4444" strokeWidth={3} strokeLinejoin="round" />
			</svg>
			{done && (
				<form
					className="absolute flex gap-2 rounded-lg bg-white p-2 shadow-lg ring-1 ring-stone-200"
					style={{ left: Math.min(maxX, (layer.current?.clientWidth ?? 0) - 340), top: maxY + 8 }}
					onPointerDown={(e) => e.stopPropagation()}
					onSubmit={(e) => {
						e.preventDefault();
						if (text.trim()) submit();
					}}
				>
					<input
						autoFocus
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => e.key === "Escape" && onCancel()}
						placeholder={t.annotationPlaceholder}
						className="w-56 rounded border border-stone-300 px-2 py-1 text-sm"
					/>
					<button type="submit" className="rounded bg-stone-900 px-3 text-sm text-white">
						{t.send}
					</button>
					<button type="button" onClick={onCancel} className="text-sm text-stone-500">
						{t.cancel}
					</button>
				</form>
			)}
		</div>
	);
}

export function Preview({ t, preview, onAnnotate }: { t: T; preview?: PreviewState; onAnnotate: (text: string, a: Annotation) => void }) {
	const [annotating, setAnnotating] = useState(false);
	const [error, setError] = useState("");
	const frame = useRef<HTMLIFrameElement>(null);
	const ready = preview?.state === "ready" && preview.url;
	const submit = async (text: string, stroke: Stroke) => {
		setAnnotating(false);
		try {
			setError("");
			onAnnotate(text, { ...stroke, page: await requestPageState(frame.current!, preview!.url!) });
		} catch {
			setError(t.pageStateTimeout);
		}
	};

	return (
		<section className="flex min-h-0 flex-col bg-stone-100">
			<div className="flex h-10 items-center gap-3 border-b border-stone-200 bg-white px-3 text-sm">
				<span className="truncate text-stone-500">{ready ? preview.url : ""}</span>
				{error && <span className="truncate text-red-700">{error}</span>}
				<button
					disabled={!ready}
					onClick={() => setAnnotating((a) => !a)}
					className={`ml-auto rounded px-3 py-1 disabled:opacity-40 ${annotating ? "bg-red-500 text-white" : "bg-stone-200"}`}
				>
					{annotating ? t.drawing : t.draw}
				</button>
			</div>
			<div className="relative flex-1">
				{ready ? (
					<iframe ref={frame} title="preview" src={preview.url} className="absolute inset-0 h-full w-full border-0 bg-white" />
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-stone-500">
						<p>{statusText(t, preview)}</p>
						{preview?.message && <pre className="max-h-64 max-w-full overflow-auto text-left text-xs text-red-700">{preview.message}</pre>}
					</div>
				)}
				{ready && annotating && (
					<AnnotationLayer
						t={t}
						onCancel={() => setAnnotating(false)}
						onSubmit={submit}
					/>
				)}
			</div>
		</section>
	);
}
