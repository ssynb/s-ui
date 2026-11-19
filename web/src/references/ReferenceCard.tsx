import type { ReactNode } from "react";
import type { Locale } from "../i18n.ts";
import { jpegSrc } from "../ScreenshotView.tsx";
import { Spinner } from "../ui.tsx";
import { STRINGS } from "./strings.ts";

/** 网格里的一张参考卡片。image 与 failed 都为空表示还在截图。 */
export type RefCard = { name: string; url: string; why: string; image?: string; failed?: string };

export const hostOf = (url: string) => new URL(url).host.replace(/^www\./, "");

/** compact：窄栏里固定两列。 */
export function CardGrid({ children, compact }: { children: ReactNode; compact?: boolean }) {
	return <ul className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"}>{children}</ul>;
}

type CardProps = { locale: Locale; card: RefCard; onOpen: (card: RefCard) => void; compact?: boolean; openLabel?: string; allowUnavailable?: boolean };

/** compact 只显示截图和名字，网址与理由在大图里看。 */
export function ReferenceCard({ locale, card, onOpen, compact, allowUnavailable, openLabel }: CardProps) {
	const s = STRINGS[locale];
	const ready = Boolean(card.image);
	return (
		<li className="min-w-0">
			<button
				type="button"
				disabled={!ready && !allowUnavailable}
				aria-label={openLabel ?? s.openFull(card.name)}
				onClick={() => onOpen(card)}
				className="group block w-full overflow-hidden rounded-md text-left ring-1 ring-line hover:ring-accent disabled:cursor-default disabled:hover:ring-line"
			>
				<div className="flex aspect-[16/10] items-center justify-center overflow-hidden bg-app">
					{card.image ? (
						<img src={jpegSrc(card.image)} alt="" className="size-full object-cover object-top" />
					) : card.failed ? (
						<span className="px-3 text-center text-xs text-muted">{card.failed}</span>
					) : (
						<Spinner className="text-muted" />
					)}
				</div>
			</button>
			<p className={`truncate font-medium ${compact ? "mt-1 text-xs" : "mt-1.5"}`} title={card.name}>
				{card.name}
			</p>
			{!compact && (
				<a href={card.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted hover:text-accent">
					{hostOf(card.url)}
				</a>
			)}
			{card.why && !compact && <p className="mt-0.5 line-clamp-2 text-xs text-pretty">{card.why}</p>}
		</li>
	);
}
