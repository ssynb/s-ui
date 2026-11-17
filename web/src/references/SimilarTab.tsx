import type { FindResult, ProductGuess } from "../../../server/modules/references.ts";
import type { PanelProps } from "../panels.ts";
import { Button, Spinner } from "../ui.tsx";
import { CardGrid, hostOf, ReferenceCard, type RefCard } from "./ReferenceCard.tsx";
import { useSimilarSearch } from "./similarSearch.ts";
import { STRINGS } from "./strings.ts";

function ProductLine({ locale, product, compact }: { locale: PanelProps["locale"]; product: ProductGuess; compact?: boolean }) {
	const s = STRINGS[locale];
	return (
		<div>
			<p className="font-medium">{s.productLine(product.kind, product.page)}</p>
			{product.summary && !compact && <p className="text-muted text-pretty">{product.summary}</p>}
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

type Props = {
	panel: PanelProps;
	onOpen: (card: RefCard) => void;
	/** 粘贴加入的页面，排在最前。 */
	pasted?: RefCard[];
	/** 窄栏布局：两列小卡片，只显示名字。 */
	compact?: boolean;
	/** 重新查找时怎么找；默认读当前项目。 */
	onFind?: () => void;
};

/** 找同类：AI 判断产品类型并给出候选，后台逐个打开验证；验证通过的边到边出现在网格里。状态按项目共享（见 similarSearch.ts）。 */
export function SimilarTab({ panel, onOpen, pasted = [], compact, onFind }: Props) {
	const { locale } = panel;
	const s = STRINGS[locale];
	const similar = useSimilarSearch(panel);
	const { search } = similar;
	const find = onFind ?? (() => similar.find());

	const found = search.state === "done" ? search.result.references : search.state === "running" ? search.kept : [];
	const pending = search.state === "running" && search.total ? search.total - search.done : 0;
	const cards = [...new Map([...pasted, ...found].map((c) => [c.url, c])).values()];

	return (
		<div className="space-y-4">
			{search.state === "idle" && (
				<div className={`space-y-3 text-center ${compact ? "py-2" : "py-6"}`}>
					<p className="mx-auto max-w-sm text-muted text-pretty">{s.findIntro}</p>
					<Button variant="primary" onClick={find}>
						{s.find}
					</Button>
				</div>
			)}
			{search.state === "running" && (
				<div className="space-y-2">
					{search.product && <ProductLine locale={locale} product={search.product} compact={compact} />}
					<p role="status" className="flex items-center gap-2 text-muted tabular-nums">
						<Spinner />
						{search.total === undefined ? s.reading : s.checking(search.done, search.total)}
					</p>
				</div>
			)}
			{search.state === "done" && (
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1 space-y-1">
						<ProductLine locale={locale} product={search.result.product} compact={compact} />
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
				<CardGrid compact={compact}>
					{cards.map((card) => (
						<ReferenceCard key={card.url} locale={locale} card={card} onOpen={onOpen} compact={compact} />
					))}
					{Array.from({ length: pending }, (_, i) => (
						<li key={`pending-${i}`} aria-hidden className="aspect-[16/10] animate-pulse rounded-md bg-app ring-1 ring-line" />
					))}
				</CardGrid>
			)}
		</div>
	);
}
