import { useState } from "react";
import type { FindProgress, FindResult, ProductGuess, ReferencesApi } from "../../../server/modules/references.ts";
import type { PanelProps } from "../panels.ts";
import { Button, Spinner } from "../ui.tsx";
import { CardGrid, hostOf, ReferenceCard, type RefCard } from "./ReferenceCard.tsx";
import { STRINGS } from "./strings.ts";

type Search =
	| { state: "idle" }
	| { state: "running"; product?: ProductGuess; total?: number; done: number; kept: RefCard[] }
	| { state: "done"; result: FindResult }
	| { state: "failed"; message: string };

function reduceProgress(search: Search, p: FindProgress): Search {
	if (search.state !== "running") return search;
	if (p.phase === "checking") return { ...search, product: p.product, total: p.total };
	if (p.phase === "checked") return { ...search, done: search.done + 1, kept: p.ref ? [...search.kept, p.ref] : search.kept };
	return search;
}

function ProductLine({ locale, product }: { locale: PanelProps["locale"]; product: ProductGuess }) {
	const s = STRINGS[locale];
	return (
		<div>
			<p className="font-medium">{s.productLine(product.kind, product.page)}</p>
			{product.summary && <p className="text-muted text-pretty">{product.summary}</p>}
		</div>
	);
}

/** 结果计数；有被丢弃的页面时可展开看每个的原因。 */
function Dropped({ locale, result }: { locale: PanelProps["locale"]; result: FindResult }) {
	const s = STRINGS[locale];
	const summary = s.found(result.references.length, result.dropped.length);
	if (!result.dropped.length) return <p className="text-xs text-muted">{summary}</p>;
	return (
		<details className="text-xs text-muted">
			<summary className="cursor-pointer hover:text-fg">{summary}</summary>
			<ul className="mt-1 space-y-0.5">
				{result.dropped.map((d) => (
					<li key={d.url} className="break-all" title={d.detail}>
						{hostOf(d.url)}
						{new URL(d.url).pathname.replace(/\/$/, "")} · {s.reasons[d.reason]}
					</li>
				))}
			</ul>
		</details>
	);
}

type Props = { panel: PanelProps; pasted: RefCard[]; onOpen: (card: RefCard) => void };

/** 找同类：AI 判断产品类型并给出候选，后台逐个打开验证；验证通过的边到边出现在网格里。粘贴加入的页面排在最前。 */
export function SimilarTab({ panel, pasted, onOpen }: Props) {
	const { locale, callModule } = panel;
	const s = STRINGS[locale];
	const [search, setSearch] = useState<Search>({ state: "idle" });

	const find = () => {
		setSearch({ state: "running", done: 0, kept: [] });
		callModule<ReferencesApi, "findSimilar">("references", "findSimilar", { locale }, {
			onProgress: (data) => setSearch((current) => reduceProgress(current, data as FindProgress)),
		})
			.then((result) => setSearch({ state: "done", result }))
			.catch((error: Error) => setSearch({ state: "failed", message: error.message }));
	};

	const found = search.state === "done" ? search.result.references : search.state === "running" ? search.kept : [];
	const pending = search.state === "running" && search.total ? search.total - search.done : 0;
	const cards = [...new Map([...pasted, ...found].map((c) => [c.url, c])).values()];

	return (
		<div className="space-y-4">
			{search.state === "idle" && (
				<div className="space-y-3 py-6 text-center">
					<p className="mx-auto max-w-sm text-muted text-pretty">{s.findIntro}</p>
					<Button variant="primary" onClick={find}>
						{s.find}
					</Button>
				</div>
			)}
			{search.state === "running" && (
				<div className="space-y-2">
					{search.product && <ProductLine locale={locale} product={search.product} />}
					<p role="status" className="flex items-center gap-2 text-muted tabular-nums">
						<Spinner />
						{search.total === undefined ? s.reading : s.checking(search.done, search.total)}
					</p>
				</div>
			)}
			{search.state === "done" && (
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1 space-y-1">
						<ProductLine locale={locale} product={search.result.product} />
						<Dropped locale={locale} result={search.result} />
					</div>
					<Button variant="ghost" onClick={find}>
						{s.findAgain}
					</Button>
				</div>
			)}
			{search.state === "done" && !search.result.references.length && <p className="text-muted">{s.noneKept}</p>}
			{search.state === "failed" && (
				<div role="alert" className="space-y-2">
					<p className="text-danger">{s.findFailed}</p>
					<p className="text-xs break-words text-muted">{search.message}</p>
					<Button onClick={find}>{s.retry}</Button>
				</div>
			)}
			{(cards.length > 0 || pending > 0) && (
				<CardGrid>
					{cards.map((card) => (
						<ReferenceCard key={card.url} locale={locale} card={card} onOpen={onOpen} />
					))}
					{Array.from({ length: pending }, (_, i) => (
						<li key={`pending-${i}`} aria-hidden className="aspect-[16/10] animate-pulse rounded-lg bg-app ring-1 ring-line" />
					))}
				</CardGrid>
			)}
		</div>
	);
}
