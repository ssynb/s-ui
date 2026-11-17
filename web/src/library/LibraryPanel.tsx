import { CircleHelp, Search, Snail, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { IconButton } from "../ui.tsx";
import type { PanelProps } from "../panels.ts";
import { EntryCard } from "./EntryCard.tsx";
import "./library.css";
import type { Choice } from "./prompt.ts";
import { CATEGORIES, ENTRIES } from "./registry.ts";
import { STRINGS } from "./strings.ts";
import { type CategoryId, defaults, type Entry, SINGLE_VARIANT } from "./types.ts";

const SLOW_FACTOR = 4;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
	return useSyncExternalStore(
		(onChange) => {
			const query = matchMedia(REDUCED_MOTION);
			query.addEventListener("change", onChange);
			return () => query.removeEventListener("change", onChange);
		},
		() => matchMedia(REDUCED_MOTION).matches,
	);
}

/** 搜索不分界面语言：用户可能记得中文名，也可能记得英文名。 */
function searchText(entry: Entry) {
	const category = CATEGORIES.find((c) => c.id === entry.category)!;
	const variant = entry.variants?.[0]?.id ?? SINGLE_VARIANT;
	const said = entry.describe(defaults(entry.params), variant);
	return [entry.name, entry.summary, category.name, said, ...(entry.variants?.map((v) => v.name) ?? [])]
		.flatMap((t) => [t.zh, t.en])
		.join(" ")
		.toLowerCase();
}

const INDEX = new Map(ENTRIES.map((e) => [e, searchText(e)]));

function initialChoice(entry: Entry): Choice {
	return { variant: entry.variants?.[0]?.id ?? SINGLE_VARIANT, params: defaults(entry.params), reasons: {} };
}

/** 「组件库」工具窗：看真实效果 → 挑做法 → 调参数 → 一键交给 AI。 */
export function LibraryPanel(props: PanelProps) {
	const { locale } = props;
	const s = STRINGS[locale];
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<CategoryId>();
	const [slow, setSlow] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);
	const [choices, setChoices] = useState<Record<string, Choice>>({});
	const reduced = useReducedMotion();

	const q = query.trim().toLowerCase();
	const visible = useMemo(() => ENTRIES.filter((e) => (!category || e.category === category) && (!q || INDEX.get(e)!.includes(q))), [category, q]);
	const groups = CATEGORIES.map((c) => ({ category: c, entries: visible.filter((e) => e.category === c.id) })).filter((g) => g.entries.length);

	const chip = (id: CategoryId | undefined, label: string) => (
		<button
			key={id ?? "all"}
			type="button"
			aria-pressed={category === id}
			onClick={() => setCategory(id)}
			className={`h-6 rounded-full px-2.5 text-xs ${category === id ? "bg-selected text-accent" : "text-muted hover:bg-hover hover:text-fg"}`}
		>
			{label}
		</button>
	);

	return (
		<div className="flex flex-col">
			<div className="sticky top-0 z-20 space-y-2 border-b border-line bg-app px-3 pt-1 pb-2">
				<div className="flex items-center gap-1">
					<label className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-panel px-2 ring-1 ring-line ring-inset focus-within:ring-accent">
						<Search size={14} aria-hidden className="shrink-0 text-faint" />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							aria-label={s.search}
							placeholder={s.search}
							className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
						/>
					</label>
					<button
						type="button"
						aria-pressed={slow}
						title={s.slowHint}
						onClick={() => setSlow(!slow)}
						className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 ${slow ? "bg-selected text-accent" : "text-muted hover:bg-hover hover:text-fg"}`}
					>
						<Snail size={15} aria-hidden />
						{s.slow}
					</button>
					<IconButton label={s.help} aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)} className={helpOpen ? "bg-selected text-accent" : ""}>
						<CircleHelp size={16} />
					</IconButton>
				</div>
				<div role="group" aria-label={s.categories} className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
					{chip(undefined, s.all)}
					{CATEGORIES.filter((c) => c.group === "motion").map((c) => chip(c.id, c.name[locale]))}
					<span aria-hidden className="mx-1 h-3.5 w-px bg-line" />
					{CATEGORIES.filter((c) => c.group === "components").map((c) => chip(c.id, c.name[locale]))}
				</div>
			</div>

			{helpOpen && <Help locale={locale} onClose={() => setHelpOpen(false)} />}
			{reduced && <p className="mx-3 mt-3 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-fg">{s.reducedMotion}</p>}

			{groups.length === 0 && (
				<div className="grid justify-items-center gap-2 px-6 py-12 text-center text-muted">
					<p>{s.noResults(query.trim())}</p>
					<button type="button" onClick={() => setQuery("")} className="text-accent hover:underline">
						{s.clearSearch}
					</button>
				</div>
			)}
			<div className="space-y-5 p-3">
				{groups.map(({ category: c, entries }) => (
					<section key={c.id} aria-labelledby={`lib-cat-${c.id}`} className="space-y-2">
						<h3 id={`lib-cat-${c.id}`} className="text-xs font-semibold text-muted">
							{c.name[locale]}
						</h3>
						{entries.map((entry) => (
							<EntryCard
								key={entry.id}
								entry={entry}
								choice={choices[entry.id] ?? initialChoice(entry)}
								onChoice={(choice) => setChoices((all) => ({ ...all, [entry.id]: choice }))}
								slow={slow ? SLOW_FACTOR : 1}
								panel={props}
							/>
						))}
					</section>
				))}
			</div>
		</div>
	);
}

function Help({ locale, onClose }: { locale: PanelProps["locale"]; onClose: () => void }) {
	const s = STRINGS[locale];
	return (
		<section aria-label={s.help} className="relative mx-3 mt-3 space-y-3 rounded-lg bg-panel p-3 ring-1 ring-line">
			<IconButton label={s.closeHelp} onClick={onClose} className="absolute top-1.5 right-1.5">
				<X size={14} />
			</IconButton>
			<div>
				<h3 className="mb-1 font-semibold">{s.sixThingsTitle}</h3>
				<ol className="list-decimal space-y-0.5 pl-5">
					{s.sixThings.map(([what, examples]) => (
						<li key={what}>
							<b className="font-medium">{what}</b>
							<span className="text-muted">{locale === "zh" ? "：" : ": "}{examples}</span>
						</li>
					))}
				</ol>
			</div>
			<div>
				<h3 className="mb-1 font-semibold">{s.checklistTitle}</h3>
				<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
					{s.checklist.map(([dim, text]) => (
						<div key={dim} className="contents">
							<dt className="font-medium">{dim}</dt>
							<dd className="text-muted">{text}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}
