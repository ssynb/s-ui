import { useEffect, useState, useSyncExternalStore } from "react";
import type { PanelProps } from "../panels.ts";
import { subscribeTargets, targetDraft, targetLayers, updateTargets } from "./targets.ts";

export function useTargetDraft(project: string) {
 const draft = useSyncExternalStore(subscribeTargets, () => targetDraft(project));
 return [draft, (update: Parameters<typeof updateTargets>[1]) => updateTargets(project, update)] as const;
}

// 两个分区可同时挂载，也可按标签单独挂载；共用串行队列，不让旧分区的异步写入覆盖新试用。
const queues = new Map<string, { tail: Promise<void>; latest: () => Promise<void> }>();
export function useTargetPreview(panel: PanelProps) {
 const [draft, update] = useTargetDraft(panel.project.dir);
 const [error, setError] = useState<string>();
 const css = targetLayers(draft);
 const highlight = draft.selected ? `:is(${draft.selected}) { outline: 2px solid #3574f0 !important; outline-offset: 4px !important; }` : "";
 useEffect(() => {
  const project = panel.project.dir;
  let queue = queues.get(project);
  if (!queue) { queue = { tail: Promise.resolve(), latest: async () => {} }; queues.set(project, queue); }
  queue.latest = async () => {
   if (!panel.preview.ready) return;
   await panel.preview.applyLayer("polish-target-trials", css);
   await panel.preview.applyLayer("polish-target-selection", highlight);
  };
  const run = () => queue.latest();
  queue.tail = queue.tail.then(run, run);
  let mounted = true;
  void queue.tail.then(() => { if (mounted) setError(undefined); }, reason => { if (mounted) setError(reason instanceof Error ? reason.message : String(reason)); });
  return () => { mounted = false; };
 }, [panel.project.dir, panel.preview.ready, css, highlight]);
 return { draft, update, error };
}
