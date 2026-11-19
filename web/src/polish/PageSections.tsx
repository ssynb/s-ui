import { RotateCw } from "lucide-react";
import { useState } from "react";
import type { ComponentInstance } from "../../../server/page-inspect.ts";
import { Button, IconButton, Spinner } from "../ui.tsx";
import type { FoundComponent, Locale, PageInspection, PanelProps } from "../panels.ts";
import { COMPONENT_VARIANTS, KIND_NAMES } from "./components.ts";
import { MOTION_EFFECTS, type MotionEffect } from "./motion.ts";
import { formatParam } from "./params.ts";
import { Notice, Section, Tile } from "./parts.tsx";
import { componentRequest, motionRequest } from "./prompt.ts";
import type { PolishDraft } from "./state.ts";
import { STRINGS } from "./strings.ts";
import { defaults, type ParamSpec } from "./types.ts";
import { clearTargets, selectTarget, type TargetTrial } from "./targets.ts";
import { useTargetDraft, useTargetPreview } from "./target-hooks.ts";
import { TARGET_STRINGS } from "./target-strings.ts";

type Props = {
 panel: PanelProps; draft: PolishDraft; setDraft: (update: (d: PolishDraft) => PolishDraft) => void;
 inspection?: PageInspection; loading: boolean; error?: string; onReinspect: () => void; disabled: boolean; note?: string;
};

export function ComponentsSection(props: Props) {
 const sync = useTargetPreview(props.panel);
 return <><PageSection {...props} mode="components" />{sync.error && <Notice tone="danger">{sync.error}</Notice>}</>;
}
export function MotionSection(props: Props) {
 const sync = useTargetPreview(props.panel);
 return <><PageSection {...props} mode="motion" />{sync.error && <Notice tone="danger">{sync.error}</Notice>}</>;
}

function PageSection({ panel, inspection, loading, error, onReinspect, disabled, note, mode }: Props & { mode: "components" | "motion" }) {
 const s = STRINGS[panel.locale];
 const words = TARGET_STRINGS[panel.locale];
 const [draft] = useTargetDraft(panel.project.dir);
 const groups = (inspection?.components ?? []).filter(c => mode === "components" ? COMPONENT_VARIANTS[c.kind] : MOTION_EFFECTS.some(e => e.kinds.includes(c.kind)));
 return <Section id={`polish-${mode}`} title={s[mode]} note={note} disabled={disabled} action={<IconButton label={s.reinspect} onClick={onReinspect} disabled={loading}><RotateCw size={14} /></IconButton>}>
  {error && <Notice tone="danger">{s.inspectFailed(error)}</Notice>}
  {loading && !inspection && <Spinner />}
  {inspection && !groups.length && <p className="text-xs text-muted">{mode === "components" ? s.noComponents : s.noMotion}</p>}
  <div className="space-y-1">
   {groups.map(group => <details key={group.kind} className="rounded-md bg-panel ring-1 ring-line">
    <summary className="cursor-pointer px-2.5 py-2 text-[13px]">{KIND_NAMES[group.kind][panel.locale]} <span className="text-muted">×{group.count}</span></summary>
    <div className="space-y-2 px-2.5 pb-2.5">
     <InstancePicker panel={panel} group={group} />
     {group.instances?.some(i => i.selector === draft.selected) && <TargetOptions panel={panel} group={group} instance={group.instances.find(i => i.selector === draft.selected)!} mode={mode} />}
    </div>
   </details>)}
  </div>
  {mode === "motion" && Object.keys(draft.trials).length > 0 && <Button variant="ghost" onClick={() => clearTargets(panel.project.dir)}>{words.trials}</Button>}
 </Section>;
}

function InstancePicker({ panel, group }: { panel: PanelProps; group: FoundComponent }) {
 const [draft, update] = useTargetDraft(panel.project.dir);
 const words = TARGET_STRINGS[panel.locale];
 return <div role="group" aria-label={words.target} className="max-h-56 space-y-1 overflow-y-auto">
  {group.instances?.map(instance => <button key={instance.selector} type="button" aria-pressed={draft.selected === instance.selector} title={instance.sourceSelector} onClick={() => update(d => d.selected === instance.selector ? d : ({ ...d, selected: instance.selector, all: Object.values(d.trials).find(t => t.target.selector === instance.selector)?.target.scope === "group" }))} className={`block min-h-7 w-full cursor-pointer rounded px-2 py-1 text-left text-xs break-words ${draft.selected === instance.selector ? "bg-selected text-accent" : "hover:bg-hover"}`}>{instance.name}</button>)}
 </div>;
}

function TargetOptions({ panel, group, instance, mode }: { panel: PanelProps; group: FoundComponent; instance: ComponentInstance; mode: "components" | "motion" }) {
 const [draft, update] = useTargetDraft(panel.project.dir);
 const words = TARGET_STRINGS[panel.locale];
 const target = selectTarget(group, instance, draft.all);
 const [applyError, setApplyError] = useState<string>();
 const prefix = `${instance.selector}:`;
 const setTrial = (id: string, trial?: TargetTrial) => update(d => {
  const trials = { ...d.trials };
  if (trial) trials[prefix + id] = trial; else delete trials[prefix + id];
  return { ...d, trials };
 });
 const apply = async (id: string, text: string) => {
  try {
   const current = await panel.preview.inspect();
   const currentGroup = current.components.find(c => c.kind === group.kind);
   const currentInstance = currentGroup?.instances?.find(i => i.selector === instance.selector);
   if (!currentGroup || !currentInstance || current.url !== target.pageUrl || selectTarget(currentGroup, currentInstance, draft.all).groupSelector !== target.groupSelector) throw new Error(words.stale);
   panel.submitToAi({ text });
   setTrial(id);
   panel.showChat();
   setApplyError(undefined);
  } catch (reason) { setApplyError(reason instanceof Error ? reason.message : String(reason)); }
 };
 return <div className="space-y-2">
  {applyError && <Notice tone="danger">{applyError}</Notice>}
  <p className="text-xs text-muted">{words.selected}</p>
  <label className="flex min-h-7 items-center gap-2 text-xs"><input type="checkbox" checked={draft.all} onChange={e => {
   const all = e.target.checked;
   update(d => ({ ...d, all, trials: Object.fromEntries(Object.entries(d.trials).map(([key, trial]) => [key, key.startsWith(prefix) ? { ...trial, target: selectTarget(group, instance, all) } : trial])) }));
  }} />{words.all}</label>
  <p className="text-xs text-muted">{draft.all ? words.group : words.only}</p>
  {mode === "components" ? <>
   <div className="grid grid-cols-2 gap-1.5">{COMPONENT_VARIANTS[group.kind]!.map(variant => <Tile key={variant.id} selected={draft.trials[prefix + "component"]?.variant === variant.id} onClick={() => setTrial("component", { target, variant: variant.id, reasons: draft.trials[prefix + "component"]?.reasons ?? {}, params: {}, run: 0 })} className="px-2 py-1.5"><span className="text-[13px]">{variant.name[panel.locale]}</span></Tile>)}</div>
   {draft.trials[prefix + "component"] && <details><summary className="cursor-pointer text-xs text-muted">{STRINGS[panel.locale].why}</summary>{COMPONENT_VARIANTS[group.kind]!.filter(v => v.id !== draft.trials[prefix + "component"]!.variant).map(v => <label key={v.id} className="mt-1 grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 text-xs"><span>{v.name[panel.locale]}</span><input className="h-7 min-w-0 rounded bg-panel px-2 ring-1 ring-line" value={draft.trials[prefix + "component"]!.reasons?.[v.id] ?? ""} placeholder={STRINGS[panel.locale].whyPlaceholder} onChange={e => { const trial = draft.trials[prefix + "component"]!; setTrial("component", { ...trial, reasons: { ...trial.reasons, [v.id]: e.target.value } }); }} /></label>)}</details>}
   {draft.trials[prefix + "component"] && <div className="flex gap-2"><Button variant="ghost" onClick={() => setTrial("component")}>{words.original}</Button><Button variant="primary" onClick={() => apply("component", componentRequest({ found: target, variant: draft.trials[prefix + "component"]!.variant!, reasons: draft.trials[prefix + "component"]!.reasons ?? {}, locale: panel.locale }))}>{words.apply}</Button></div>}
  </> : <>
   <p className="text-xs text-muted">{words.trigger}</p>
   {MOTION_EFFECTS.filter(e => e.kinds.includes(group.kind)).map(effect => {
    const trial = draft.trials[prefix + effect.id];
    return <div key={effect.id} className="space-y-2">
     <button type="button" aria-pressed={Boolean(trial)} onClick={() => setTrial(effect.id, trial ? undefined : { target, effect: effect.id, params: defaults(effect.params), run: 0 })} className={`min-h-7 cursor-pointer rounded px-2 text-xs ${trial ? "bg-selected text-accent" : "hover:bg-hover"}`}>{effect.name[panel.locale]}{effect.demo ? ` · ${words.demo}` : ""}</button>
     {trial && <MotionOptions panel={panel} effect={effect} trial={trial} update={next => setTrial(effect.id, next)} onApply={() => apply(effect.id, motionRequest({ found: target, effect, params: trial.params, locale: panel.locale }))} />}
    </div>;
   })}
  </>}
 </div>;
}

function MotionOptions({ panel, effect, trial, update, onApply }: { panel: PanelProps; effect: MotionEffect; trial: TargetTrial; update: (trial: TargetTrial) => void; onApply: () => void }) {
 const locale = panel.locale;
 const words = TARGET_STRINGS[locale];
 return <div className="space-y-2 rounded-md p-2 ring-1 ring-line">
  <p className="text-xs text-muted">{effect.describe(trial.params)[locale]}</p>
  {effect.demo && <ConfirmExample locale={locale} />}
  {effect.params.map(spec => <ParamControl key={spec.key} spec={spec} value={trial.params[spec.key] ?? spec.default} locale={locale} onChange={value => update({ ...trial, params: { ...trial.params, [spec.key]: value }, run: trial.run + 1 })} />)}
  {effect.source && <a className="text-xs text-accent underline" href={effect.source} target="_blank" rel="noreferrer">{words.source}</a>}
  <div className="flex gap-2">{effect.replayable && <Button variant="ghost" onClick={() => update({ ...trial, run: trial.run + 1 })}>{words.replay}</Button>}<Button variant="primary" onClick={onApply}>{words.apply}</Button></div>
 </div>;
}

function ConfirmExample({ locale }: { locale: Locale }) {
 const [state, setState] = useState<"idle" | "confirm" | "pending" | "done" | "failed">("idle");
 const s = TARGET_STRINGS[locale];
 return <div className="space-y-2 rounded bg-app p-2" aria-label={s.demo}>
  <p className="text-xs text-muted">{s.demo}</p>
  <style>{`@keyframes sui-confirm-state { from { opacity: 0; transform: translateY(3px); } } @media (prefers-reduced-motion: no-preference) { .sui-confirm-state { animation: sui-confirm-state 160ms ease-out; } }`}</style>
  <div key={state} role="status" className="sui-confirm-state text-xs">{state === "pending" ? s.pending : state === "done" ? s.done : state === "failed" ? s.failed : ""}</div>
  <div className="flex flex-wrap gap-2">
   {state === "idle" && <Button onClick={() => setState("confirm")}>{s.start}</Button>}
   {state === "confirm" && <><Button onClick={() => setState("pending")}>{s.confirm}</Button><Button variant="ghost" onClick={() => setState("idle")}>{s.cancel}</Button></>}
   {state === "pending" && <><Button onClick={() => setState("done")}>{s.success}</Button><Button onClick={() => setState("failed")}>{s.failure}</Button></>}
   {(state === "done" || state === "failed") && <Button onClick={() => setState("idle")}>{s.replay}</Button>}
  </div>
 </div>;
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
