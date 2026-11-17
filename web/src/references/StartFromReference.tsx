import { type FormEvent, useEffect, useState } from "react";
import type { StartFromReferenceProps } from "../panels.ts";
import { Button, Spinner } from "../ui.tsx";
import { CuratedTab } from "./CuratedTab.tsx";
import type { RefCard } from "./ReferenceCard.tsx";
import { type OpenCard, ReferenceViewer, type ViewerAction } from "./ReferenceViewer.tsx";
import { SimilarTab } from "./SimilarTab.tsx";
import { lastDescription, useSimilarSearch, useStartPageOpen } from "./similarSearch.ts";
import { STRINGS } from "./strings.ts";

type Tab = "similar" | "curated";
/** “照这个做”这一轮：已发出 → AI 开始处理 → 结束后回到空闲。 */
type Build = "idle" | "sent" | "working";

/**
 * 空项目时预览区显示的内容（契约见 panels.ts 的 StartFromReferenceProps）：先选一个参考定基调。
 * 用户可写一句想做什么，按描述找同类；精选随时可选。点卡片看大图，“照这个做”让 AI 照参考搭出页面并生成设计变量文件。
 */
export function StartFromReference({ panel, defaultMessage }: StartFromReferenceProps) {
	const s = STRINGS[panel.locale];
	const similar = useSimilarSearch(panel);
	useStartPageOpen(panel.project.dir);
	const [description, setDescription] = useState(() => lastDescription(panel.project.dir));
	const [build, setBuild] = useState<Build>("idle");
	useEffect(() => {
		if (build === "sent" && panel.busy) setBuild("working");
		if (build === "working" && !panel.busy) setBuild("idle");
	}, [build, panel.busy]);
	const [tab, setTab] = useState<Tab>(similar.search.state === "idle" ? "curated" : "similar");
	const [open, setOpen] = useState<OpenCard>();
	const onOpen = (card: RefCard) => card.image && setOpen({ ...card, image: card.image });

	const find = () => {
		similar.find(description);
		setTab("similar");
	};
	const submit = (e: FormEvent) => {
		e.preventDefault();
		find();
	};

	const buildAction: ViewerAction = {
		label: s.buildThis,
		onSubmitted: () => setBuild("sent"),
		compose: ({ name, url, image }, aspects) => ({
			text: s.build({ name, url, aspects, description: description.trim() }),
			images: [{ data: image, mimeType: "image/jpeg" }],
		}),
	};
	const tabs: Tab[] = similar.search.state === "idle" ? ["curated"] : ["similar", "curated"];
	const label = { similar: s.tabSimilar, curated: s.tabCurated };

	return (
		<div className="mx-auto max-w-5xl space-y-5 px-8 py-8">
			<div className="space-y-1">
				<h2 className="text-lg font-semibold text-balance">{s.startTitle}</h2>
				<p className="max-w-2xl text-muted text-pretty">{s.startHint}</p>
			</div>
			{build !== "idle" && (
				<p role="status" className="flex items-center gap-2 text-muted">
					<Spinner />
					{s.building}
				</p>
			)}
			<form onSubmit={submit} className="flex max-w-2xl gap-2">
				<input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					aria-label={s.describeLabel}
					placeholder={s.describePlaceholder}
					className="h-7 min-w-0 flex-1 rounded-md bg-panel px-2 ring-1 ring-line ring-inset outline-none focus:ring-accent"
				/>
				<Button type="submit" variant="primary" disabled={!description.trim() || similar.search.state === "running"}>
					{s.findForDescription}
				</Button>
			</form>
			<div role="tablist" aria-label={s.title} className="flex gap-1 border-b border-line">
				{tabs.map((id) => (
					<button
						key={id}
						type="button"
						role="tab"
						id={`start-ref-tab-${id}`}
						aria-selected={id === tab}
						aria-controls={`start-ref-panel-${id}`}
						onClick={() => setTab(id)}
						className={`-mb-px h-8 border-b-2 px-2 text-[13px] ${id === tab ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
					>
						{label[id]}
					</button>
				))}
			</div>
			<div role="tabpanel" id={`start-ref-panel-${tab}`} aria-labelledby={`start-ref-tab-${tab}`}>
				{tab === "similar" ? <SimilarTab panel={panel} onOpen={onOpen} onFind={find} /> : <CuratedTab panel={panel} onOpen={onOpen} />}
			</div>
			<p className="text-xs text-muted">{defaultMessage}</p>
			{open && <ReferenceViewer {...panel} card={open} action={buildAction} onClose={() => setOpen(undefined)} />}
		</div>
	);
}
