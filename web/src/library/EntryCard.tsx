import { ChevronDown, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../ui.tsx";
import type { Locale, PanelProps } from "../panels.ts";
import { buildPrompt, type Choice, formatParam } from "./prompt.ts";
import { STRINGS } from "./strings.ts";
import { defaults, type Entry, type ParamSpec, SINGLE_VARIANT } from "./types.ts";

const STAGE_HEIGHT = { single: 128, compare: 112 };

type Props = {
	entry: Entry;
	choice: Choice;
	onChoice: (choice: Choice) => void;
	slow: number;
	panel: PanelProps;
};

/** 一个条目：演示（多种做法并排）、调参数、怎么跟 AI 说、用这个。 */
export function EntryCard({ entry, choice, onChoice, slow, panel }: Props) {
	const { locale, selection, busy } = panel;
	const s = STRINGS[locale];
	const id = useId();
	const [tuning, setTuning] = useState(false);
	const [reasonsOpen, setReasonsOpen] = useState(false);
	const other: Locale = locale === "zh" ? "en" : "zh";
	const variants = entry.variants ?? [{ id: SINGLE_VARIANT, name: entry.name }];
	const compare = variants.length > 1;
	const height = entry.stageHeight ?? (compare ? STAGE_HEIGHT.compare : STAGE_HEIGHT.single);
	const set = (patch: Partial<Choice>) => onChoice({ ...choice, ...patch });
	const changed = entry.params.some((p) => choice.params[p.key] !== p.default);

	const use = () => {
		const target = selection ? { kind: "selection" as const, count: selection.elements.length } : { kind: "page" as const };
		panel.submitToAi({ text: buildPrompt(entry, choice, target, locale), withSelection: Boolean(selection) });
		panel.showChat();
	};

	return (
		<article aria-labelledby={`${id}-name`} className="rounded-lg bg-panel ring-1 ring-line">
			<header className="px-3 pt-2.5">
				<h4 id={`${id}-name`} className="flex flex-wrap items-baseline gap-x-2">
					<span className="font-semibold">{entry.name[locale]}</span>
					<span className="text-xs text-muted">{entry.name[other]}</span>
				</h4>
				<p className="text-xs text-pretty text-muted">{entry.summary[locale]}</p>
			</header>

			<div
				role={compare ? "radiogroup" : undefined}
				aria-label={compare ? s.variants : undefined}
				className={`grid gap-2 p-2 ${compare ? "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]" : ""}`}
			>
				{variants.map((v) => {
					const chosen = compare && v.id === choice.variant;
					return (
						<div key={v.id} className={`overflow-hidden rounded-md ${compare ? (chosen ? "ring-2 ring-accent" : "ring-1 ring-line") : ""}`}>
							<div aria-label={s.demo} role="group" className="relative grid place-items-center overflow-hidden bg-app px-3" style={{ height }}>
								<entry.Demo p={choice.params} variant={v.id} slow={slow} locale={locale} />
							</div>
							{compare && (
								<label className="flex h-7 cursor-pointer items-center gap-1.5 border-t border-line px-2 text-xs">
									<input type="radio" name={`${id}-variant`} checked={chosen} onChange={() => set({ variant: v.id })} className="accent-accent" />
									<span className={chosen ? "font-medium text-fg" : "text-muted"}>{v.name[locale]}</span>
								</label>
							)}
						</div>
					);
				})}
			</div>

			{tuning && (
				<div className="space-y-3 border-t border-line px-3 py-2.5">
					{entry.params.length > 0 && (
						<div className="space-y-1.5">
							{entry.params.map((spec) => (
								<ParamControl key={spec.key} spec={spec} value={choice.params[spec.key] ?? spec.default} locale={locale} onChange={(value) => set({ params: { ...choice.params, [spec.key]: value } })} />
							))}
							{changed && (
								<button type="button" onClick={() => set({ params: defaults(entry.params) })} className="text-xs text-accent hover:underline">
									{s.resetParams}
								</button>
							)}
						</div>
					)}
					<div className="rounded-md bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] px-2.5 py-2">
						<h5 className="mb-0.5 text-xs font-medium text-muted">{s.sayToAi}</h5>
						<p className="text-pretty">“{entry.describe(choice.params, choice.variant)[locale]}”</p>
					</div>
					{compare && (
						<div>
							<button type="button" aria-expanded={reasonsOpen} onClick={() => setReasonsOpen(!reasonsOpen)} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
								<ChevronDown size={14} className={reasonsOpen ? "rotate-180" : ""} aria-hidden />
								{s.reasonsToggle}
							</button>
							{reasonsOpen && (
								<div className="mt-1.5 space-y-1.5">
									{variants
										.filter((v) => v.id !== choice.variant)
										.map((v) => (
											<label key={v.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 text-xs">
												<span className="truncate text-muted">{v.name[locale]}</span>
												<input
													value={choice.reasons[v.id] ?? ""}
													onChange={(e) => set({ reasons: { ...choice.reasons, [v.id]: e.target.value } })}
													placeholder={s.reasonPlaceholder}
													className="h-7 min-w-0 rounded-md bg-panel px-2 text-[13px] ring-1 ring-line ring-inset placeholder:text-faint focus:ring-accent focus:outline-none"
												/>
											</label>
										))}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<footer className="flex items-center gap-2 border-t border-line px-2 py-1.5">
				<Button variant="ghost" aria-expanded={tuning} onClick={() => setTuning(!tuning)} className="px-2 text-muted">
					<ChevronDown size={14} className={tuning ? "rotate-180" : ""} aria-hidden />
					{s.tune}
				</Button>
				<span className="min-w-0 flex-1 truncate text-right text-xs text-muted" title={busy ? s.queued : selection ? undefined : s.toPageHint}>
					{selection ? s.toSelection(selection.elements.length) : s.toPage}
				</span>
				<Button variant="primary" onClick={use}>
					<Sparkles size={14} aria-hidden />
					{s.use}
				</Button>
			</footer>
		</article>
	);
}

function ParamControl({ spec, value, locale, onChange }: { spec: ParamSpec; value: number | string; locale: Locale; onChange: (value: number | string) => void }) {
	const label = spec.label[locale];
	const row = "grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2";
	if (spec.kind === "range")
		return (
			<label className={row}>
				<span className="truncate text-xs text-muted">{label}</span>
				<span className="flex items-center gap-2">
					<input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-accent" />
					<output className="w-14 shrink-0 text-right text-xs tabular-nums">{formatParam(spec, value, locale)}</output>
				</span>
			</label>
		);
	if (spec.kind === "color")
		return (
			<label className={row}>
				<span className="truncate text-xs text-muted">{label}</span>
				<span className="flex items-center gap-2">
					<input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
					<span className="font-mono text-xs text-muted">{value}</span>
				</span>
			</label>
		);
	return (
		<label className={row}>
			<span className="truncate text-xs text-muted">{label}</span>
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
