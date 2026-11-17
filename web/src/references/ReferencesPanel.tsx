import { type FormEvent, useState } from "react";
import type { ReferencesApi } from "../../../server/modules/references.ts";
import type { PanelProps } from "../panels.ts";
import { Button } from "../ui.tsx";
import { CuratedTab } from "./CuratedTab.tsx";
import { hostOf, type RefCard } from "./ReferenceCard.tsx";
import { ReferenceViewer } from "./ReferenceViewer.tsx";
import { SimilarTab } from "./SimilarTab.tsx";
import { STRINGS } from "./strings.ts";

/** 页面标题常是「品牌 | 口号」：取包含域名的那一段作名字，找不到取第一段。 */
function siteName(title: string, url: string) {
	const parts = title.split(/\s+[|–—·-]\s+|:\s+/).filter(Boolean);
	const domain = hostOf(url).split(".")[0]!.toLowerCase();
	return parts.find((p) => p.toLowerCase().replace(/\s/g, "").includes(domain)) ?? parts[0] ?? hostOf(url);
}

const TABS = ["similar", "curated"] as const;
type Tab = (typeof TABS)[number];

/** 「参考页面」工具窗。找到的结果属于当前项目，切换项目时重置。 */
export function ReferencesPanel(props: PanelProps) {
	return <ProjectReferences key={props.project.dir} {...props} />;
}

function PasteUrl({ panel, onAdded }: { panel: PanelProps; onAdded: (card: RefCard) => void }) {
	const s = STRINGS[panel.locale];
	const [url, setUrl] = useState("");
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setAdding(true);
		setError(undefined);
		try {
			const shot = await panel.callModule<ReferencesApi, "capture">("references", "capture", { url });
			if (!shot.ok) return setError(s.pasteFailed(s.reasons[shot.reason]));
			onAdded({ name: siteName(shot.title, shot.url), url: shot.url, why: "", image: shot.image });
			setUrl("");
		} catch (error) {
			setError(s.pasteFailed(`${s.reasons.unreachable} (${(error as Error).message})`));
		} finally {
			setAdding(false);
		}
	};

	return (
		<form onSubmit={submit} className="space-y-1">
			<div className="flex gap-2">
				<input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					aria-label={s.pasteLabel}
					placeholder={s.pastePlaceholder}
					disabled={adding}
					className="h-7 min-w-0 flex-1 rounded-md bg-panel px-2 ring-1 ring-line ring-inset outline-none focus:ring-accent"
				/>
				<Button type="submit" disabled={adding || !url.trim()}>
					{adding ? s.adding : s.add}
				</Button>
			</div>
			{error && (
				<p role="alert" className="text-xs break-words text-danger">
					{error}
				</p>
			)}
		</form>
	);
}

function ProjectReferences(props: PanelProps) {
	const s = STRINGS[props.locale];
	const [tab, setTab] = useState<Tab>("similar");
	const [curatedSeen, setCuratedSeen] = useState(false);
	if (tab === "curated" && !curatedSeen) setCuratedSeen(true);
	const [pasted, setPasted] = useState<RefCard[]>([]);
	const [open, setOpen] = useState<RefCard & { image: string }>();
	const onOpen = (card: RefCard) => card.image && setOpen({ ...card, image: card.image });
	const label = { similar: s.tabSimilar, curated: s.tabCurated };

	return (
		<div className="space-y-3 p-3">
			<PasteUrl
				panel={props}
				onAdded={(card) => {
					setPasted((list) => [card, ...list.filter((c) => c.url !== card.url)]);
					setTab("similar");
				}}
			/>
			<div role="tablist" aria-label={s.title} className="flex gap-1 border-b border-line">
				{TABS.map((id) => (
					<button
						key={id}
						type="button"
						role="tab"
						id={`references-tab-${id}`}
						aria-selected={id === tab}
						aria-controls={`references-panel-${id}`}
						onClick={() => setTab(id)}
						className={`-mb-px h-8 border-b-2 px-2 text-[13px] ${id === tab ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
					>
						{label[id]}
					</button>
				))}
			</div>
			<div role="tabpanel" id="references-panel-similar" aria-labelledby="references-tab-similar" hidden={tab !== "similar"}>
				<SimilarTab panel={props} pasted={pasted} onOpen={onOpen} />
			</div>
			<div role="tabpanel" id="references-panel-curated" aria-labelledby="references-tab-curated" hidden={tab !== "curated"}>
				{/* 精选第一次切过来时才挂载（避免一打开工具窗就去截图），之后保持挂载。 */}
				{curatedSeen && <CuratedTab panel={props} onOpen={onOpen} />}
			</div>
			{open && <ReferenceViewer {...props} card={open} onClose={() => setOpen(undefined)} />}
		</div>
	);
}
