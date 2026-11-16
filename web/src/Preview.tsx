import { MousePointer2, PenLine, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PageCapture } from "../../server/page-capture.ts";
import { type Annotation, PAGE_CAPTURE_MESSAGE, type Point } from "../../server/protocol.ts";
import type { T } from "./i18n.ts";
import { Button, IconButton, Spinner } from "./ui.tsx";
import type { Preview as PreviewState } from "./useWorkspace.ts";

const MIN_STROKE_POINTS = 3;
const PAGE_CAPTURE_TIMEOUT_MS = 5000;

type Stroke = Omit<Annotation, "capture">;

/** 请预览里注入的桥接脚本在用户此刻的页面上采集圈注现场（iframe 跨源，工作台读不到）。 */
function requestCapture(frame: HTMLIFrameElement, previewUrl: string, stroke: Point[]) {
	const id = crypto.randomUUID();
	return new Promise<PageCapture>((resolve, reject) => {
		const timer = setTimeout(() => {
			removeEventListener("message", onMessage);
			reject(new Error("page capture timeout"));
		}, PAGE_CAPTURE_TIMEOUT_MS);
		function onMessage(e: MessageEvent) {
			if (e.source !== frame.contentWindow || e.data?.type !== PAGE_CAPTURE_MESSAGE || e.data.id !== id) return;
			clearTimeout(timer);
			removeEventListener("message", onMessage);
			resolve(e.data.capture);
		}
		addEventListener("message", onMessage);
		frame.contentWindow!.postMessage({ type: PAGE_CAPTURE_MESSAGE, id, stroke }, new URL(previewUrl).origin);
	});
}

const STROKE_COLOR = "#ef4444";
const POPOVER_WIDTH_PX = 360;

function PreviewStatus({ t, preview }: { t: T; preview: PreviewState }) {
	const busy = preview.state === "installing" || preview.state === "starting";
	const text = {
		empty: t.previewEmpty,
		installing: t.previewInstalling,
		starting: t.previewStarting,
		error: t.previewError,
		stopped: t.previewStopped,
		ready: "",
	}[preview.state];
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
			<p className={`flex max-w-md items-center gap-2 ${preview.state === "error" ? "text-danger" : "text-muted"}`}>
				{busy && <Spinner />}
				{text}
			</p>
			{preview.message && (
				<pre className="max-h-72 w-full max-w-2xl overflow-auto rounded-md bg-app p-3 text-left font-mono text-xs text-muted ring-1 ring-line">{preview.message}</pre>
			)}
		</div>
	);
}

/** 画圈覆盖层：在 iframe 上方记录一笔闭合手绘路径，松手后附一句话发出；再按下会重画。 */
function AnnotationLayer({ t, onSubmit, onExit }: { t: T; onSubmit: (text: string, a: Stroke) => void; onExit: () => void }) {
	const layer = useRef<HTMLDivElement>(null);
	const [stroke, setStroke] = useState<Point[]>([]);
	const [drawing, setDrawing] = useState(false);
	const [text, setText] = useState("");
	const done = !drawing && stroke.length >= MIN_STROKE_POINTS;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
		addEventListener("keydown", onKey);
		return () => removeEventListener("keydown", onKey);
	}, [onExit]);

	const pointOf = (e: React.PointerEvent): Point => {
		const r = layer.current!.getBoundingClientRect();
		return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
	};
	const submit = () => {
		const { width, height } = layer.current!.getBoundingClientRect();
		onSubmit(text.trim(), { stroke, viewport: { width: Math.round(width), height: Math.round(height) } });
	};
	const [maxX, maxY] = stroke.reduce(([x, y], [px, py]) => [Math.max(x, px), Math.max(y, py)], [0, 0]);
	const width = layer.current?.clientWidth ?? 0;
	const height = layer.current?.clientHeight ?? 0;

	return (
		<div
			ref={layer}
			className="absolute inset-0 cursor-crosshair touch-none ring-2 ring-accent ring-inset"
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				setDrawing(true);
				setStroke([pointOf(e)]);
			}}
			onPointerMove={(e) => drawing && setStroke((s) => [...s, pointOf(e)])}
			onPointerUp={() => setDrawing(false)}
		>
			<svg className="pointer-events-none absolute inset-0 h-full w-full">
				<polygon points={stroke.map((p) => p.join(",")).join(" ")} fill={`${STROKE_COLOR}14`} stroke={STROKE_COLOR} strokeWidth={3} strokeLinejoin="round" />
			</svg>
			{!done && (
				<div
					role="status"
					className="pointer-events-auto absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-raised py-1 pr-1 pl-3 shadow-lg ring-1 ring-line"
					onPointerDown={(e) => e.stopPropagation()}
				>
					<PenLine size={14} className="text-accent" />
					<span>{t.drawingBanner}</span>
					<kbd className="rounded bg-hover px-1.5 font-sans text-xs text-muted">{t.escToExit}</kbd>
					<IconButton label={t.exitDraw} onClick={onExit} className="size-6 rounded-full">
						<X size={14} />
					</IconButton>
				</div>
			)}
			{done && (
				<form
					className="absolute flex items-center gap-1.5 rounded-lg bg-raised p-1.5 shadow-xl ring-1 ring-line"
					style={{ width: POPOVER_WIDTH_PX, left: Math.max(8, Math.min(maxX - POPOVER_WIDTH_PX / 2, width - POPOVER_WIDTH_PX - 8)), top: Math.min(maxY + 8, height - 52) }}
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
						aria-label={t.annotationPlaceholder}
						placeholder={t.annotationPlaceholder}
						className="h-7 min-w-0 flex-1 rounded-md bg-panel px-2 ring-1 ring-line ring-inset placeholder:text-faint focus:ring-accent focus:outline-none"
					/>
					<Button type="submit" variant="primary" disabled={!text.trim()}>
						{t.send}
					</Button>
					<IconButton label={t.exitDraw} onClick={onExit}>
						<X size={14} />
					</IconButton>
				</form>
			)}
		</div>
	);
}

type PreviewProps = { t: T; preview?: PreviewState; onAnnotate: (text: string, a: Annotation) => void };

export function Preview({ t, preview, onAnnotate }: PreviewProps) {
	const [annotating, setAnnotating] = useState(false);
	const [error, setError] = useState("");
	const [reloads, setReloads] = useState(0);
	const frame = useRef<HTMLIFrameElement>(null);
	const url = preview?.state === "ready" ? preview.url : undefined;
	const exit = useRef(() => setAnnotating(false)).current;

	const submit = async (text: string, stroke: Stroke) => {
		setAnnotating(false);
		try {
			setError("");
			onAnnotate(text, { ...stroke, capture: await requestCapture(frame.current!, url!, stroke.stroke) });
		} catch {
			setError(t.captureFailed);
		}
	};

	return (
		<section aria-label={t.previewTab} className="flex min-h-0 flex-col bg-panel">
			<div role="tablist" className="flex h-9 shrink-0 items-end border-b border-line bg-app px-1">
				<div role="tab" aria-selected className="flex h-full items-center gap-1.5 border-b-2 border-accent px-3">
					<span aria-hidden className={`size-1.5 rounded-full ${url ? "bg-success" : "bg-faint"}`} />
					{t.previewTab}
				</div>
			</div>
			<div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-1.5">
				<IconButton label={t.reload} disabled={!url} onClick={() => setReloads((n) => n + 1)}>
					<RotateCw size={14} />
				</IconButton>
				<div className="flex h-7 min-w-0 flex-1 items-center rounded-md bg-app px-2 font-mono text-xs text-muted">
					<span className="truncate">{url ?? ""}</span>
				</div>
				<Button
					variant={annotating ? "primary" : "default"}
					aria-pressed={annotating}
					disabled={!url}
					onClick={() => setAnnotating((a) => !a)}
					className="ml-1"
				>
					{annotating ? <X size={14} /> : <MousePointer2 size={14} />}
					{annotating ? t.exitDraw : t.draw}
				</Button>
			</div>
			{error && (
				<p role="alert" className="flex items-center gap-2 border-b border-line bg-danger/10 px-3 py-1.5 text-danger">
					<span className="flex-1">{error}</span>
					<IconButton label={t.cancel} onClick={() => setError("")} className="size-6">
						<X size={14} />
					</IconButton>
				</p>
			)}
			<div className="relative min-h-0 flex-1">
				{url ? (
					<iframe key={reloads} ref={frame} title={t.previewTab} src={url} className="absolute inset-0 h-full w-full border-0 bg-white" />
				) : (
					preview && <PreviewStatus t={t} preview={preview} />
				)}
				{url && annotating && <AnnotationLayer t={t} onExit={exit} onSubmit={submit} />}
			</div>
		</section>
	);
}
