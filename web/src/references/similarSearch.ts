import { useSyncExternalStore } from "react";
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

/** 当前项目的找同类状态，以及发起查找（不给描述时读项目，给了按描述）。 */
export function useSimilarSearch({ project, locale, callModule }: PanelProps) {
	const dir = project.dir;
	const search = useSyncExternalStore(subscribe, () => searches.get(dir) ?? IDLE);

	const find = (description?: string) => {
		if (searches.get(dir)?.state === "running") return;
		set(dir, () => ({ state: "running", done: 0, kept: [] }));
		callModule<ReferencesApi, "findSimilar">("references", "findSimilar", { locale, description }, {
			onProgress: (data) => set(dir, (current) => reduceProgress(current, data as FindProgress)),
		})
			.then((result) => set(dir, () => ({ state: "done", result })))
			.catch((error: Error) => set(dir, () => ({ state: "failed", message: error.message })));
	};

	return { search, find };
}
