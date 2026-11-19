import { MousePointer2, RotateCw, X } from "lucide-react";
import { type ReactNode, type RefObject, type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import type { PageCapture } from "../../server/page-capture.ts";
import { type Annotation, ANNOTATION_PAGE_MESSAGE, PAGE_CAPTURE_MESSAGE, type Point } from "../../server/protocol.ts";
import type { T } from "./i18n.ts";
import { AnnotationEditor, AnnotationLayer, AnnotationMarks } from "./AnnotationEditor.tsx";
import { Button, IconButton, Spinner } from "./ui.tsx";
import type { Preview as PreviewState } from "./useWorkspace.ts";

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
			if (e.source !== frame.contentWindow || e.origin !== new URL(previewUrl).origin || e.data?.type !== PAGE_CAPTURE_MESSAGE || e.data.id !== id) return;
			clearTimeout(timer);
			removeEventListener("message", onMessage);
			resolve(e.data.capture);
		}
		addEventListener("message", onMessage);
		frame.contentWindow!.postMessage({ type: PAGE_CAPTURE_MESSAGE, id, stroke }, new URL(previewUrl).origin);
	});
}

function PreviewStatus({ t, preview }: { t: T; preview: PreviewState }) {
	const busy = preview.state === "installing" || preview.state === "starting";
	const text = {
		empty: t.previewEmpty,
		missing: t.previewMissing,
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

type PreviewProps = {
	t: T;
	preview?: PreviewState;
	onChoosePage?: () => void;
	/** 当前圈选（含画圈那一刻的页面现场），由上层持有，工具窗面板也能用。 */
	selection: Annotation[];
	onSelectionChange: Dispatch<SetStateAction<Annotation[]>>;
	onCapturing: (value: boolean) => void;
	request: string;
	onRequestChange: (value: string) => void;
	/** 在画圈弹框里写了一句话并发送。 */
	onSubmitSelection: (text: string) => void;
	/** 项目还没有页面（预览状态 empty）时预览区显示的内容。 */
	empty: ReactNode;
	missing: ReactNode;
	/** 预览 iframe；由上层持有，预览操作（PanelProps.preview）也经它通信。 */
	frame: RefObject<HTMLIFrameElement | null>;
};

export function Preview({ t, preview, onChoosePage, selection, onSelectionChange, onCapturing, request: text, onRequestChange: setText, onSubmitSelection, empty, missing, frame }: PreviewProps) {
	const [annotating, setAnnotating] = useState(false);
	const [capturing, setCapturing] = useState(false);
	const [error, setError] = useState("");
	const [reloads, setReloads] = useState(0);
	const generation = useRef(0);
	const nextNumber = useRef(1);
	const pageState = useRef<{ documentId: string; href: string } | undefined>(undefined);
	const [view, setView] = useState<string>();
	const url = preview?.state === "ready" ? preview.url : undefined;
	const clear = () => {
		generation.current++;
		onSelectionChange([]);
		setText(""); setCapturing(false); onCapturing(false); setError("");
		nextNumber.current = 1;
	};
	useEffect(() => {
		clear(); pageState.current = undefined;
		function onMessage(e: MessageEvent) {
			if (!url || e.source !== frame.current?.contentWindow || e.origin !== new URL(url).origin || e.data?.type !== ANNOTATION_PAGE_MESSAGE) return;
			const state = e.data;
			if (state.leaving) {
				if (pageState.current?.documentId === state.documentId) { clear(); pageState.current = undefined; }
				return;
			}
			if (pageState.current && (pageState.current.documentId !== state.documentId || pageState.current.href !== state.href)) clear();
			pageState.current = state;
			setView(state.view);
		}
		addEventListener("message", onMessage);
		return () => { generation.current++; onCapturing(false); removeEventListener("message", onMessage); };
	}, [url]);
	useEffect(() => {
		if (!selection.length && !capturing) { nextNumber.current = 1; setText(""); }
	}, [selection.length, capturing]);
	const capture = async (stroke: Stroke) => {
		const attempt = generation.current;
		const number = nextNumber.current++;
		setCapturing(true); onCapturing(true); setError("");
		try {
			const captured = await requestCapture(frame.current!, url!, stroke.stroke);
			if (attempt !== generation.current) return;
			if (pageState.current && (captured.documentId !== pageState.current.documentId || captured.href !== pageState.current.href)) return;
			onSelectionChange(items => [...items, { ...stroke, number, capture: captured }]);
		} catch {
			if (attempt === generation.current) setError(t.captureFailed);
		} finally {
			if (attempt === generation.current) { setCapturing(false); onCapturing(false); }
		}
	};
	const exit = () => setAnnotating(false);

	return (
		<section aria-label={t.previewTab} className="flex min-h-0 flex-1 flex-col bg-panel">
			<div role="tablist" className="flex h-9 shrink-0 items-end border-b border-line bg-app px-1">
				<div role="tab" aria-selected className="flex h-full items-center gap-1.5 border-b-2 border-accent px-3">
					<span aria-hidden className={`size-1.5 rounded-full ${url ? "bg-success" : "bg-faint"}`} />
					{t.previewTab}
				</div>
			</div>
			<div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-1.5">
				<IconButton label={t.reload} disabled={!url} onClick={() => { clear(); setReloads((n) => n + 1); }}>
					<RotateCw size={14} />
				</IconButton>
				<div className="flex h-7 min-w-0 flex-1 items-center rounded-md bg-app px-2 font-mono text-xs text-muted">
					<span className="truncate">{url ?? ""}</span>
				</div>
				{onChoosePage && <Button onClick={onChoosePage}>{t.changePage}</Button>}
				<Button
					variant={annotating ? "primary" : "default"}
					aria-pressed={annotating}
					disabled={!url}
					onClick={() => (annotating ? exit() : setAnnotating(true))}
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
					<iframe onLoad={() => { clear(); pageState.current = undefined; frame.current?.contentWindow?.postMessage({ type: ANNOTATION_PAGE_MESSAGE }, new URL(url).origin); }} key={reloads} ref={frame} title={t.previewTab} src={url} className="absolute inset-0 h-full w-full border-0 bg-white" />
				) : (
					preview &&
					(preview.state === "missing" ? missing : preview.state === "empty" ? (
						<div className="h-full overflow-auto">{empty}</div>
					) : (
						<PreviewStatus t={t} preview={preview} />
					))
				)}
				{url && <AnnotationMarks selection={selection} view={view} />}
				{url && annotating && <AnnotationLayer t={t} disabled={capturing} onStroke={capture} onExit={exit} />}
				{selection.length > 0 && <AnnotationEditor
					t={t} selection={selection} onChange={onSelectionChange} request={text} onRequestChange={setText} disabled={capturing}
					onSubmit={() => { onSubmitSelection(text.trim()); clear(); setAnnotating(false); }}
				/>}

			</div>
		</section>
	);
}
