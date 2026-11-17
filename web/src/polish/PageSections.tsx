import { ChevronDown, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Spinner } from "../ui.tsx";
import type { ComponentKind, FoundComponent, Locale, PageInspection, PanelProps } from "../panels.ts";
import { COMPONENT_VARIANTS, KIND_NAMES } from "./components.ts";
import { MOTION_EFFECTS, type MotionEffect } from "./motion.ts";
import { formatParam } from "./params.ts";
import { Notice, Section, Tile } from "./parts.tsx";
import { componentRequest, motionRequest } from "./prompt.ts";
import { motionKey, type MotionTrial, type PolishDraft } from "./state.ts";
import { STRINGS } from "./strings.ts";
import { defaults, type ParamSpec } from "./types.ts";

type Props = {
	panel: PanelProps;
	draft: PolishDraft;
	setDraft: (update: (d: PolishDraft) => PolishDraft) => void;
	inspection?: PageInspection;
	loading: boolean;
	error?: string;
	onReinspect: () => void;
	disabled: boolean;
	note?: string;
};

/** 交给 AI 后撤掉该项试用样式：之后页面上看到的就是 AI 改好的代码。 */
function handOff(panel: PanelProps, text: string) {
	panel.submitToAi({ text });
	panel.showChat();
}

function InspectState({ locale, inspection, loading, error }: Pick<Props, "inspection" | "loading" | "error"> & { locale: Locale }) {
	const s = STRINGS[locale];
	if (error) return <Notice tone="danger">{s.inspectFailed(error)}</Notice>;
	if (!inspection && loading)
		return (
			<p className="flex items-center gap-2 text-xs text-muted">
				<Spinner /> {s.inspecting}
			</p>
		);
	return null;
}

export function ComponentsSection({ panel, draft, setDraft, inspection, loading, error, onReinspect, disabled, note }: Props) {
	const { locale } = panel;
	const s = STRINGS[locale];
	const [open, setOpen] = useState<ComponentKind>();
	const found = inspection?.components.filter((c) => COMPONENT_VARIANTS[c.kind]) ?? [];
	return (
		<Section
			id="polish-components"
			title={s.components}
			note={note}
			disabled={disabled}
			action={
				!disabled && (
					<IconButton label={s.reinspect} onClick={onReinspect} disabled={loading} className="size-6">
						{loading ? <Spinner /> : <RotateCw size={14} />}
					</IconButton>
				)
			}
		>
			<InspectState locale={locale} inspection={inspection} loading={loading} error={error} />
			{inspection && found.length === 0 && <p className="text-xs text-muted">{s.noComponents}</p>}
			<div className="divide-y divide-line overflow-hidden rounded-md bg-panel ring-1 ring-line">
				{found.map((c) => (
					<ComponentRow
						key={c.kind}
						panel={panel}
						found={c}
						open={open === c.kind}
						onToggle={() => setOpen(open === c.kind ? undefined : c.kind)}
						draft={draft}
						setDraft={setDraft}
					/>
				))}
			</div>
		</Section>
	);
}

function ComponentRow({ panel, found, open, onToggle, draft, setDraft }: { panel: PanelProps; found: FoundComponent; open: boolean; onToggle: () => void } & Pick<Props, "draft" | "setDraft">) {
	const { locale } = panel;
	const s = STRINGS[locale];
	const [whyOpen, setWhyOpen] = useState(false);
	const variants = COMPONENT_VARIANTS[found.kind]!;
	const trial = draft.components[found.kind];
	const chosen = variants.find((v) => v.id === trial?.variant);
	const setTrial = (variant?: string) =>
		setDraft((d) => {
			const components = { ...d.components };
			if (!variant || variant === components[found.kind]?.variant) delete components[found.kind];
			else components[found.kind] = { variant, reasons: components[found.kind]?.reasons ?? {} };
			return { ...d, components };
		});
	const setReason = (id: string, reason: string) =>
		setDraft((d) => {
			const current = d.components[found.kind];
			return current ? { ...d, components: { ...d.components, [found.kind]: { ...current, reasons: { ...current.reasons, [id]: reason } } } } : d;
		});
	const apply = () => {
		handOff(panel, componentRequest({ found, variant: trial!.variant, reasons: trial!.reasons, locale }));
		setTrial(undefined);
	};

	return (
		<div>
			<button type="button" aria-expanded={open} onClick={onToggle} className="flex h-9 w-full items-center gap-2 px-2.5 text-left hover:bg-hover">
				<span className="font-medium">{KIND_NAMES[found.kind][locale]}</span>
				<span className="text-xs text-muted tabular-nums">×{found.count}</span>
				<span className="min-w-0 flex-1 truncate text-xs text-faint">{found.text}</span>
				{chosen && <span className="shrink-0 text-xs text-accent">{chosen.name[locale]}</span>}
				<ChevronDown size={14} aria-hidden className={`shrink-0 text-muted ${open ? "rotate-180" : ""}`} />
			</button>
			{open && (
				<div className="space-y-2 px-2.5 pb-2.5">
					<div className="grid grid-cols-2 gap-1.5">
						<Tile selected={!trial} onClick={() => setTrial(undefined)} className="px-2 py-1.5">
							<span className="block text-[13px] font-medium">{s.original}</span>
						</Tile>
						{variants.map((v) => (
							<Tile key={v.id} selected={trial?.variant === v.id} onClick={() => setTrial(v.id)} title={v.look[locale]} className="px-2 py-1.5">
								<span className="block truncate text-[13px] font-medium">{v.name[locale]}</span>
							</Tile>
						))}
					</div>
					{chosen && (
						<>
							<p className="text-xs text-pretty text-muted">{chosen.look[locale]}</p>
							<button type="button" aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
								<ChevronDown size={14} aria-hidden className={whyOpen ? "rotate-180" : ""} />
								{s.why}
							</button>
							{whyOpen &&
								variants
									.filter((v) => v.id !== chosen.id)
									.map((v) => (
										<label key={v.id} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 text-xs">
											<span className="truncate text-muted">{v.name[locale]}</span>
											<input
												value={trial?.reasons[v.id] ?? ""}
												onChange={(e) => setReason(v.id, e.target.value)}
												placeholder={s.whyPlaceholder}
												className="h-7 min-w-0 rounded-md bg-panel px-2 text-[13px] ring-1 ring-line ring-inset placeholder:text-faint focus:ring-accent focus:outline-none"
											/>
										</label>
									))}
							<ApplyRow locale={locale} onApply={apply} />
						</>
					)}
				</div>
			)}
		</div>
	);
}

function ApplyRow({ locale, onApply, extra }: { locale: Locale; onApply: () => void; extra?: React.ReactNode }) {
	const s = STRINGS[locale];
	return (
		<div className="flex items-center gap-2">
			{extra}
			<span className="min-w-0 flex-1 truncate text-right text-xs text-muted" title={s.applyHint}>
				{s.applyHint}
			</span>
			<Button variant="primary" onClick={onApply}>
				<Sparkles size={14} aria-hidden />
				{s.apply}
			</Button>
		</div>
	);
}

export function MotionSection({ panel, draft, setDraft, inspection, loading, error, disabled, note }: Props) {
	const { locale } = panel;
	const s = STRINGS[locale];
	const groups = (inspection?.components ?? [])
		.map((found) => ({ found, effects: MOTION_EFFECTS.filter((e) => e.kinds.includes(found.kind)) }))
		.filter((g) => g.effects.length);
	const active = (effect: MotionEffect, kind: ComponentKind) => draft.motions.find((t) => t.effect === effect.id && t.kind === kind);
	const toggle = (effect: MotionEffect, kind: ComponentKind) =>
		setDraft((d) => ({
			...d,
			motions: d.motions.some((t) => t.effect === effect.id && t.kind === kind)
				? d.motions.filter((t) => !(t.effect === effect.id && t.kind === kind))
				: [...d.motions, { effect: effect.id, kind, params: defaults(effect.params), run: 0 }],
		}));
	const update = (trial: MotionTrial, patch: Partial<MotionTrial>) =>
		setDraft((d) => ({ ...d, motions: d.motions.map((t) => (motionKey(t) === motionKey(trial) ? { ...t, ...patch } : t)) }));

	return (
		<Section id="polish-motion" title={s.motion} note={note} disabled={disabled}>
			<InspectState locale={locale} inspection={inspection} loading={loading} error={error} />
			{inspection && groups.length === 0 && <p className="text-xs text-muted">{s.noMotion}</p>}
			<div className="space-y-3">
				{groups.map(({ found, effects }) => (
					<div key={found.kind} className="space-y-1.5">
						<h4 className="text-xs text-muted">
							{KIND_NAMES[found.kind][locale]} <span className="tabular-nums">×{found.count}</span>
						</h4>
						<div className="flex flex-wrap gap-1">
							{effects.map((effect) => {
								const on = Boolean(active(effect, found.kind));
								return (
									<button
										key={effect.id}
										type="button"
										aria-pressed={on}
										title={effect.summary[locale]}
										onClick={() => toggle(effect, found.kind)}
										className={`h-7 rounded-full px-2.5 text-xs ring-1 ring-inset ${on ? "bg-selected text-accent ring-accent/40" : "bg-panel text-fg ring-line hover:bg-hover"}`}
									>
										{effect.name[locale]}
									</button>
								);
							})}
						</div>
						{effects.map((effect) => {
							const trial = active(effect, found.kind);
							return (
								trial && (
									<MotionTrialCard
										key={effect.id}
										panel={panel}
										found={found}
										effect={effect}
										trial={trial}
										onParams={(params) => update(trial, { params, run: trial.run + (effect.replayable ? 1 : 0) })}
										onReplay={() => update(trial, { run: trial.run + 1 })}
										onApply={() => {
											handOff(panel, motionRequest({ found, effect, params: trial.params, locale }));
											toggle(effect, found.kind);
										}}
									/>
								)
							);
						})}
					</div>
				))}
			</div>
		</Section>
	);
}

function MotionTrialCard({ panel, effect, trial, onParams, onReplay, onApply }: { panel: PanelProps; found: FoundComponent; effect: MotionEffect; trial: MotionTrial; onParams: (p: MotionTrial["params"]) => void; onReplay: () => void; onApply: () => void }) {
	const { locale } = panel;
	const s = STRINGS[locale];
	return (
		<div className="space-y-1.5 rounded-md bg-panel p-2.5 ring-1 ring-line">
			<p className="text-xs text-pretty text-muted">{effect.describe(trial.params)[locale]}</p>
			{effect.params.map((spec) => (
				<ParamControl key={spec.key} spec={spec} value={trial.params[spec.key] ?? spec.default} locale={locale} onChange={(value) => onParams({ ...trial.params, [spec.key]: value })} />
			))}
			<ApplyRow
				locale={locale}
				onApply={onApply}
				extra={
					effect.replayable && (
						<Button variant="ghost" onClick={onReplay} className="px-2 text-muted">
							<RotateCcw size={13} aria-hidden />
							{s.replay}
						</Button>
					)
				}
			/>
		</div>
	);
}

function ParamControl({ spec, value, locale, onChange }: { spec: ParamSpec; value: number | string; locale: Locale; onChange: (value: number | string) => void }) {
	const row = "grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2";
	const label = <span className="truncate text-xs text-muted">{spec.label[locale]}</span>;
	if (spec.kind === "range")
		return (
			<label className={row}>
				{label}
				<span className="flex items-center gap-2">
					<input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-accent" />
					<output className="w-14 shrink-0 text-right text-xs tabular-nums">{formatParam(spec, value, locale)}</output>
				</span>
			</label>
		);
	return (
		<label className={row}>
			{label}
			<select value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-7 min-w-0 rounded-md bg-panel px-1.5 text-[13px] ring-1 ring-line ring-inset focus:ring-accent focus:outline-none">
				{spec.options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label[locale]}
					</option>
				))}
			</select>
		</label>
	);
}
