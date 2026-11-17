import { useEffect } from "react";
import type { Locale, TokenValues } from "../panels.ts";
import { contrastRatio, readableOn, toHex } from "./color.ts";
import { FONT_PAIRS } from "./fonts.ts";
import { PALETTES } from "./palettes.ts";
import { Section, TextButton, Tile } from "./parts.tsx";
import { SHAPE_RANGES, type ShapeKnob, shapeValue } from "./shape.ts";
import type { PolishDraft } from "./state.ts";
import { STRINGS } from "./strings.ts";

type Props = {
	locale: Locale;
	draft: PolishDraft;
	setDraft: (update: (d: PolishDraft) => PolishDraft) => void;
	/** 变量文件里已保存的值。 */
	saved: TokenValues;
	disabled: boolean;
	note?: string;
};

// 字体样例要在工作台自己的页面里也能显示：把全部搭配的样式表挂到工作台 <head>（网页字体按需下载用到的字）。
function useWorkbenchFonts() {
	useEffect(() => {
		for (const url of new Set(FONT_PAIRS.flatMap((p) => p.urls))) {
			if (document.head.querySelector(`link[data-polish-font="${CSS.escape(url)}"]`)) continue;
			const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: url });
			link.dataset.polishFont = url;
			document.head.append(link);
		}
	}, []);
}

export function FontSection({ locale, draft, setDraft, saved, disabled, note }: Props) {
	const s = STRINGS[locale];
	useWorkbenchFonts();
	const savedPair = FONT_PAIRS.find((p) => p.sans === saved["--sui-font-sans"] && p.heading === saved["--sui-font-heading"]);
	// 点已选中的、或点文件里本来就是的那组，都回到原样
	const pick = (id?: string) => setDraft((d) => ({ ...d, font: id === d.font || id === savedPair?.id ? undefined : id }));
	const sample = (heading: string | undefined, body: string | undefined) => (
		<>
			<span className="block truncate text-xl leading-7" style={{ fontFamily: heading }}>
				{s.fontSampleHeading}
			</span>
			<span className="block truncate text-xs" style={{ fontFamily: body }}>
				{s.fontSample}
			</span>
		</>
	);
	return (
		<Section id="polish-fonts" title={s.fonts} note={note} disabled={disabled}>
			<div className="grid grid-cols-2 gap-1.5">
				{!savedPair && (
					<Tile selected={!draft.font} onClick={() => pick(undefined)} className="p-2">
						{sample(saved["--sui-font-heading"], saved["--sui-font-sans"])}
						<span className="mt-1 block truncate text-xs font-medium">{s.original}</span>
					</Tile>
				)}
				{FONT_PAIRS.map((pair) => (
					<Tile key={pair.id} selected={draft.font ? draft.font === pair.id : pair.id === savedPair?.id} onClick={() => pick(pair.id)} className="p-2">
						{sample(pair.heading, pair.sans)}
						<span className="mt-1 block truncate text-xs font-medium">
							{pair.name[locale]}
							{pair.id === savedPair?.id && <span className="ml-1 font-normal text-muted">· {s.current}</span>}
						</span>
						<span className="block truncate text-xs text-muted">{pair.style[locale]}</span>
					</Tile>
				))}
			</div>
		</Section>
	);
}

export function ColorSection({ locale, draft, setDraft, saved, disabled, note }: Props) {
	const s = STRINGS[locale];
	const savedPalette = PALETTES.find((p) => p.primary === saved["--sui-color-primary"] && p.bg === saved["--sui-color-bg"] && p.text === saved["--sui-color-text"]);
	const chosen = PALETTES.find((p) => p.id === draft.palette);
	const primary = draft.primary ?? chosen?.primary ?? toHex(saved["--sui-color-primary"] ?? "") ?? "#3574f0";
	const onPrimary = readableOn(primary);
	const pick = (id?: string) => setDraft((d) => ({ ...d, primary: undefined, palette: id === d.palette || id === savedPalette?.id ? undefined : id }));
	const original = { bg: saved["--sui-color-bg"], surface: saved["--sui-color-surface"], text: saved["--sui-color-text"], primary: saved["--sui-color-primary"], border: saved["--sui-color-border"] };
	const swatches = (c: Partial<Record<"bg" | "surface" | "text" | "primary" | "border", string>>) => (
		<span aria-hidden className="flex h-6 overflow-hidden rounded ring-1 ring-line">
			{[c.bg, c.surface, c.border, c.text, c.primary].map((color, i) => (
				<span key={i} className="flex-1" style={{ background: color ?? "transparent" }} />
			))}
		</span>
	);
	return (
		<Section id="polish-colors" title={s.colors} note={note} disabled={disabled}>
			<div className="grid grid-cols-3 gap-1.5">
				{!savedPalette && (
					<Tile selected={!draft.palette && !draft.primary} onClick={() => pick(undefined)} className="space-y-1 p-1.5">
						{swatches(original)}
						<span className="block truncate text-xs">{s.original}</span>
					</Tile>
				)}
				{PALETTES.map((p) => (
					<Tile key={p.id} selected={draft.palette ? draft.palette === p.id : !draft.primary && p.id === savedPalette?.id} onClick={() => pick(p.id)} className="space-y-1 p-1.5">
						{swatches(p)}
						<span className="block truncate text-xs">
							{p.name[locale]}
							{p.id === savedPalette?.id && <span className="text-muted"> · {s.current}</span>}
						</span>
					</Tile>
				))}
			</div>
			<label className="mt-2 flex items-center gap-2">
				<span className="w-20 shrink-0 text-xs text-muted">{s.primaryColor}</span>
				<input type="color" value={primary} onChange={(e) => setDraft((d) => ({ ...d, primary: e.target.value }))} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
				<span className="font-mono text-xs">{primary}</span>
				<span className="ml-auto truncate rounded px-1.5 py-0.5 text-xs" style={{ background: primary, color: onPrimary }}>
					{s.textOnPrimary(onPrimary, contrastRatio(primary, onPrimary).toFixed(1))}
				</span>
			</label>
		</Section>
	);
}

const KNOBS: ShapeKnob[] = ["radius", "space", "shadow"];

export function ShapeSection({ locale, draft, setDraft, saved, disabled, note }: Props) {
	const s = STRINGS[locale];
	const label = { radius: s.radius, space: s.space, shadow: s.shadow };
	const shown = (knob: ShapeKnob, value: number) => (knob === "shadow" ? s.shadowLevels[value] : `${value}px`);
	const set = (knob: ShapeKnob, value?: number) =>
		setDraft((d) => {
			const shape = { ...d.shape };
			if (value === undefined || value === shapeValue(knob, saved)) delete shape[knob];
			else shape[knob] = value;
			return { ...d, shape };
		});
	return (
		<Section id="polish-shape" title={s.shape} note={note} disabled={disabled}>
			<div className="space-y-1.5">
				{KNOBS.map((knob) => {
					const value = draft.shape[knob] ?? shapeValue(knob, saved);
					const r = SHAPE_RANGES[knob];
					return (
						<label key={knob} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem_2.5rem] items-center gap-2">
							<span className="text-xs text-muted">{label[knob]}</span>
							<input type="range" min={r.min} max={r.max} step={r.step} value={value} onChange={(e) => set(knob, Number(e.target.value))} className="min-w-0 accent-accent" />
							<output className="text-right text-xs tabular-nums">{shown(knob, value)}</output>
							{draft.shape[knob] !== undefined ? <TextButton onClick={() => set(knob)}>{s.reset}</TextButton> : <span />}
						</label>
					);
				})}
			</div>
		</Section>
	);
}
