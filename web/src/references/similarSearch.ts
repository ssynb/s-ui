import { useEffect, useSyncExternalStore } from "react";
import type { FindProgress, FindResult, ProductGuess, ReferencesApi } from "../../../server/modules/references.ts";
import type { PanelProps } from "../panels.ts";
import type { RefCard } from "./ReferenceCard.tsx";

// 每个项目一份找同类的状态：「参考页面」工具窗、嵌入别的面板的同类参考、空项目的起步页都读写这一份，
// 结果互相可见，查找进行中不会再发起第二次。

export type Search =
	| { state: "idle" }
	| { state: "running"; product?: ProductGuess; total?: number; done: number; kept: RefCard[] }
	| { state: "done"; result: FindResult }
	| { state: "failed"; message: string };

const IDLE: Search = { state: "idle" };
const searches = new Map<string, Search>();
// 空项目里按描述查找时记下描述；起步页开着（项目还没有页面）时，别处的“重新查找”也沿用它，而不是去读空项目。
const descriptions = new Map<string, string>();
const startPageOpen = new Set<string>();
const listeners = new Set<() => void>();

function set(dir: string, update: (current: Search) => Search) {
	searches.set(dir, update(searches.get(dir) ?? IDLE));
	for (const listener of listeners) listener();
}

function reduceProgress(search: Search, p: FindProgress): Search {
	if (search.state !== "running") return search;
	if (p.phase === "checking") return { ...search, product: p.product, total: p.total };
	if (p.phase === "checked") return { ...search, done: search.done + 1, kept: p.ref ? [...search.kept, p.ref] : search.kept };
	return search;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** 起步页挂载期间登记“这个项目还没有页面”。 */
export function useStartPageOpen(dir: string) {
	useEffect(() => {
		startPageOpen.add(dir);
		return () => {
			startPageOpen.delete(dir);
		};
	}, [dir]);
}

/** 上次按描述查找用的描述（起步页恢复输入框用）。 */
export const lastDescription = (dir: string) => descriptions.get(dir) ?? "";

/** 当前项目的找同类状态，以及发起查找：给了描述按描述；不给时项目还没有页面就沿用上次的描述，否则读项目。 */
export function useSimilarSearch({ project, locale, callModule }: PanelProps) {
	const dir = project.dir;
	const search = useSyncExternalStore(subscribe, () => searches.get(dir) ?? IDLE);

	const find = (given?: string) => {
		if (searches.get(dir)?.state === "running") return;
		if (given?.trim()) descriptions.set(dir, given.trim());
		const description = given?.trim() || (startPageOpen.has(dir) ? descriptions.get(dir) : undefined);
		set(dir, () => ({ state: "running", done: 0, kept: [] }));
		callModule<ReferencesApi, "findSimilar">("references", "findSimilar", { locale, description }, {
			onProgress: (data) => set(dir, (current) => reduceProgress(current, data as FindProgress)),
		})
			.then((result) => set(dir, () => ({ state: "done", result })))
			.catch((error: Error) => set(dir, () => ({ state: "failed", message: error.message })));
	};

	return { search, find };
}
