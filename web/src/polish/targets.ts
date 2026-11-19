import type { ComponentInstance } from "../../../server/page-inspect.ts";
import type { FoundComponent } from "../panels.ts";
import { componentLayer } from "./components.ts";
import { MOTION_EFFECTS, motionLayer } from "./motion.ts";
import type { ParamValues } from "./types.ts";

export type Target = FoundComponent & { pageUrl: string; scope: "one" | "group"; sourceSelector: string };
export function selectTarget(group: FoundComponent, instance: ComponentInstance, all = false): Target {
 return { ...group, pageUrl: instance.pageUrl, selector: instance.selector, groupSelector: all ? group.instances!.map(i => i.selector).join(", ") : instance.selector, count: all ? group.count : 1, text: instance.name, styles: instance.styles, scope: all ? "group" : "one", sourceSelector: all ? group.groupSelector : instance.sourceSelector };
}

export type TargetTrial = { target: Target; variant?: string; reasons?: Record<string, string>; effect?: string; params: ParamValues; run: number };
export type TargetDraft = { selected?: string; all: boolean; trials: Record<string, TargetTrial> };
const EMPTY: TargetDraft = { all: false, trials: {} };
const drafts = new Map<string, TargetDraft>();
const listeners = new Set<() => void>();
export const targetDraft = (project: string): TargetDraft => drafts.get(project) ?? EMPTY;
export function subscribeTargets(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function updateTargets(project: string, update: (draft: TargetDraft) => TargetDraft) {
 drafts.set(project, update(targetDraft(project)));
 for (const notify of listeners) notify();
}
export function clearTargets(project: string) { updateTargets(project, () => EMPTY); }
export const targetChangeCount = (project: string) => Object.keys(targetDraft(project).trials).length;
export function targetLayers(draft: TargetDraft) {
 return Object.values(draft.trials).map(trial => {
  if (trial.variant) return componentLayer(trial.target, trial.variant);
  const effect = MOTION_EFFECTS.find(e => e.id === trial.effect);
  return effect ? motionLayer(effect, trial.target, trial.params, trial.run) : "";
 }).join("\n");
}
