import { useEffect, useState } from "react";
import type { ReferencesApi, Shot } from "../../../server/modules/references.ts";
import type { PanelProps } from "../panels.ts";
import { CURATED } from "./curated.ts";
import { CardGrid, ReferenceCard, type RefCard } from "./ReferenceCard.tsx";
import { STRINGS } from "./strings.ts";

type Props = { panel: PanelProps; onOpen: (card: RefCard) => void };

/** 精选：按页面类型分组，选中一类时才给这一类的页面截图（后台按 URL 缓存）。 */
export function CuratedTab({ panel, onOpen }: Props) {
	const { locale, callModule } = panel;
	const [categoryId, setCategoryId] = useState(CURATED[0]!.id);
	const [shots, setShots] = useState<Record<string, Shot | "loading">>({});
	const category = CURATED.find((c) => c.id === categoryId)!;

	useEffect(() => {
		const missing = category.pages.filter((p) => !shots[p.url]);
		if (!missing.length) return;
		setShots((current) => ({ ...current, ...Object.fromEntries(missing.map((p) => [p.url, "loading"])) }));
		for (const { url } of missing) {
			callModule<ReferencesApi, "capture">("references", "capture", { url })
				.catch((error: Error): Shot => ({ ok: false, url, reason: "unreachable", detail: error.message }))
				.then((shot) => setShots((current) => ({ ...current, [url]: shot })));
		}
	}, [category, shots, callModule]);

	// 再点一次分类会重试这一类里没打开的页面（成功的截图后台已缓存）。
	const select = (id: string) => {
		const urls = new Set(CURATED.find((c) => c.id === id)!.pages.map((p) => p.url));
		setShots((current) => Object.fromEntries(Object.entries(current).filter(([url, shot]) => !urls.has(url) || shot === "loading" || shot.ok)));
		setCategoryId(id);
	};

	const cards: RefCard[] = category.pages.map(({ name, url, why }) => {
		const shot = shots[url];
		const captured = shot && shot !== "loading" ? shot : undefined;
		return { name, url, why: why[locale], image: captured?.ok ? captured.image : undefined, failed: captured && !captured.ok ? STRINGS[locale].reasons[captured.reason] : undefined };
	});

	return (
		<div className="space-y-3">
			<div role="radiogroup" aria-label={STRINGS[locale].pageType} className="flex flex-wrap gap-1.5">
				{CURATED.map((c) => (
					<button
						key={c.id}
						type="button"
						role="radio"
						aria-checked={c.id === categoryId}
						onClick={() => select(c.id)}
						className={`h-7 rounded-md px-2.5 text-[13px] ${c.id === categoryId ? "bg-selected text-accent" : "text-fg ring-1 ring-line ring-inset hover:bg-hover"}`}
					>
						{c.title[locale]}
					</button>
				))}
			</div>
			<CardGrid>
				{cards.map((card) => (
					<ReferenceCard key={card.url} locale={locale} card={card} onOpen={onOpen} />
				))}
			</CardGrid>
		</div>
	);
}
