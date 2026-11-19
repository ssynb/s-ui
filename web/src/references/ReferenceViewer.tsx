import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReferencesApi } from "../../../server/modules/references.ts";
import type { AiSubmission, PanelProps } from "../panels.ts";
import { ScreenshotView } from "../ScreenshotView.tsx";
import { Button, Spinner } from "../ui.tsx";
import { hostOf, type RefCard } from "./ReferenceCard.tsx";
import { ASPECTS, type Aspect, STRINGS } from "./strings.ts";

export type OpenCard = RefCard & { image: string };

/** 大图里的主按钮：文案和交给 AI 的内容。默认是「参考这个」改当前页面（有圈选时只改圈选部分）。 */
export type ViewerAction = { label: string; compose: (card: OpenCard, aspects: Aspect[]) => AiSubmission; onSubmitted?: () => void };

export type ReferenceChoice = { label: string; onChoose: (card: OpenCard) => void };
type Props = PanelProps & { card: OpenCard; onClose: () => void; action?: ViewerAction; choice?: ReferenceChoice };

/** 大图：先显示首屏，整页长截图拍好后换上，可滚动查看；右侧选参考哪些方面，交给 AI。 */
export function ReferenceViewer({ card, onClose, action, choice, locale, selection, callModule, submitToAi, showChat }: Props) {
	const s = STRINGS[locale];
	const [fullPage, setFullPage] = useState<string | "loading" | "failed">("loading");
	const [aspects, setAspects] = useState<Set<Aspect>>(() => new Set(ASPECTS));

	useEffect(() => {
		callModule<ReferencesApi, "capture">("references", "capture", { url: card.url, fullPage: true })
			.then((shot) => setFullPage(shot.ok ? shot.image : "failed"))
			.catch(() => setFullPage("failed"));
	}, [callModule, card.url]);

	const toggle = (aspect: Aspect) => {
		const next = new Set(aspects);
		if (!next.delete(aspect)) next.add(aspect);
		setAspects(next);
	};

	const restyle: ViewerAction = {
		label: s.useThis,
		compose: ({ name, url, image }, chosen) => ({
			text: s.instruction({ name, url, aspects: chosen, withSelection: Boolean(selection) }),
			images: [{ data: image, mimeType: "image/jpeg" }],
			withSelection: Boolean(selection),
		}),
	};
	const { label, compose, onSubmitted } = action ?? restyle;

	const submit = () => {
		if (choice) {
			choice.onChoose(card);
			onClose();
			return;
		}
		submitToAi(compose(card, ASPECTS.filter((a) => aspects.has(a))));
		onSubmitted?.();
		showChat();
		onClose();
	};

	const image = fullPage === "loading" || fullPage === "failed" ? card.image : fullPage;
	return (
		<ScreenshotView closeLabel={s.close} title={card.name} image={image} onClose={onClose}>
			<div className="space-y-1">
				<a href={card.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-muted hover:text-accent">
					<span className="truncate">{hostOf(card.url)}</span>
					<ExternalLink size={12} className="shrink-0" aria-label={s.openInBrowser} />
				</a>
				{card.why && <p className="text-pretty">{card.why}</p>}
			</div>
			{fullPage === "loading" && (
				<p className="flex items-center gap-2 text-xs text-muted">
					<Spinner />
					{s.fullPageLoading}
				</p>
			)}
			{fullPage === "failed" && <p className="text-xs text-muted">{s.fullPageFailed}</p>}
			{!choice && <fieldset className="space-y-1.5">
				<legend className="mb-1.5 text-muted">{s.borrow}</legend>
				{ASPECTS.map((aspect) => (
					<label key={aspect} className="flex cursor-pointer items-center gap-2">
						<input type="checkbox" checked={aspects.has(aspect)} onChange={() => toggle(aspect)} className="accent-accent" />
						{s.aspects[aspect]}
					</label>
				))}
			</fieldset>}
			{selection && !action && !choice && <p className="text-xs text-muted">{s.selectionOnly(selection.elements.length)}</p>}
			<Button variant="primary" disabled={!choice && !aspects.size} onClick={submit} className="justify-center">
				{choice?.label ?? label}
			</Button>
		</ScreenshotView>
	);
}
