import { PenLine, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import type { Annotation, Point } from "../../server/protocol.ts";
import type { T } from "./i18n.ts";
import { Button, IconButton, Spinner } from "./ui.tsx";

const MIN_STROKE_POINTS = 3;
const STROKE_COLOR = "#ef4444";
type Stroke = Omit<Annotation, "capture">;

type LayerProps = {
	t: T;
	onStroke: (stroke: Stroke) => void;
	onExit: () => void;
	disabled: boolean;
};

export function AnnotationLayer({ t, onStroke, onExit, disabled }: LayerProps) {
	const layer = useRef<HTMLDivElement>(null);
	const [drawing, setDrawing] = useState<Point[]>();
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
		addEventListener("keydown", onKey);
		return () => removeEventListener("keydown", onKey);
	}, [onExit]);
	const pointOf = (e: React.PointerEvent): Point => {
		const r = layer.current!.getBoundingClientRect();
		return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
	};
	return <div ref={layer} className="absolute inset-0 cursor-crosshair touch-none ring-2 ring-accent ring-inset"
		onPointerDown={e => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); setDrawing([pointOf(e)]); }}
		onPointerMove={e => drawing && setDrawing([...drawing, pointOf(e)])}
		onPointerCancel={() => setDrawing(undefined)}
		onPointerUp={() => {
			setDrawing(undefined);
			if (!drawing || drawing.length < MIN_STROKE_POINTS) return;
			const { width, height } = layer.current!.getBoundingClientRect();
			onStroke({ stroke: drawing, viewport: { width: Math.round(width), height: Math.round(height) } });
		}}>
		<svg className="pointer-events-none absolute inset-0 h-full w-full"><polygon points={drawing?.map(p => p.join(",")).join(" ")} fill={`${STROKE_COLOR}14`} stroke={STROKE_COLOR} strokeWidth={3} /></svg>
		<div role="status" className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-raised px-3 py-1 shadow-lg ring-1 ring-line">
			<PenLine size={14} className="text-accent" />{disabled ? <Spinner /> : t.drawingBanner}<kbd>{t.escToExit}</kbd>
		</div>
	</div>;
}

export function AnnotationMarks({ selection, view }: { selection: Annotation[]; view?: string }) {
	return (
		<svg className="pointer-events-none absolute inset-0 h-full w-full">
			{selection.filter(a => a.capture.view === view).map(a => (
				<g key={a.number}>
					<polygon points={a.stroke.map(p => p.join(",")).join(" ")} fill={`${STROKE_COLOR}14`} stroke={STROKE_COLOR} strokeWidth={3} />
					<text x={Math.max(16, Math.min(...a.stroke.map(p => p[0])))} y={Math.max(24, Math.min(...a.stroke.map(p => p[1])))} fill={STROKE_COLOR} stroke="white" strokeWidth={3} paintOrder="stroke" fontSize={20} fontWeight="bold">{a.number}</text>
				</g>
			))}
		</svg>
	);
}

type EditorProps = {
	t: T;
	selection: Annotation[];
	onChange: Dispatch<SetStateAction<Annotation[]>>;
	request: string;
	onRequestChange: (value: string) => void;
	disabled: boolean;
	onSubmit: () => void;
};

export function AnnotationEditor({ t, selection, onChange, request, onRequestChange, disabled, onSubmit }: EditorProps) {
	const canSend = !disabled && (request.trim() || selection.some(a => a.note?.trim()));
	return (
		<form className="absolute right-3 bottom-3 flex max-h-[60%] w-80 flex-col gap-2 overflow-auto rounded-lg bg-raised p-3 shadow-xl ring-1 ring-line"
			onSubmit={e => { e.preventDefault(); if (canSend) onSubmit(); }}>
			{selection.map(a => (
				<div key={a.number} className="flex items-center gap-2">
					<span className="text-danger">{a.number}</span>
					<input
						aria-label={`${t.circleNote} ${a.number}`} placeholder={t.annotationPlaceholder} value={a.note ?? ""}
						onChange={e => onChange(items => items.map(item => item.number === a.number ? { ...item, note: e.target.value } : item))}
						className="h-7 min-w-0 flex-1 rounded-md bg-panel px-2 ring-1 ring-line focus:outline-accent"
					/>
					<IconButton label={`${t.deleteCircle} ${a.number}`} onClick={() => onChange(items => items.filter(item => item.number !== a.number))}><X size={14} /></IconButton>
				</div>
			))}
			<input aria-label={t.overallRequest} placeholder={t.overallRequest} value={request} onChange={e => onRequestChange(e.target.value)} className="h-7 rounded-md bg-panel px-2 ring-1 ring-line focus:outline-accent" />
			<Button type="submit" variant="primary" disabled={!canSend}>{t.sendChanges}</Button>
		</form>
	);
}
