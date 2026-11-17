import { Check, CircleAlert, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PanelProps, PolishApi } from "../panels.ts";
import { SimilarProducts } from "../references/SimilarProducts.tsx";
import { Button, Spinner } from "../ui.tsx";
import { savePayload } from "./draft.ts";
import { useInspection, usePolishStatus, usePreviewSync } from "./hooks.ts";
import { ComponentsSection, MotionSection } from "./PageSections.tsx";
import { Notice, TextButton } from "./parts.tsx";
import { changeCount, desiredLayers, EMPTY_DRAFT, type PolishDraft, tokenChangeCount, tokenDraft, usePolishDraft } from "./state.ts";
import { STRINGS } from "./strings.ts";
import { ColorSection, FontSection, ShapeSection } from "./TokenSections.tsx";

const NAV = [
	["polish-fonts", "fonts"],
	["polish-colors", "colors"],
	["polish-shape", "shape"],
	["polish-components", "components"],
	["polish-motion", "motion"],
	["polish-references", "references"],
] as const;

/** 「打磨」工具窗：只放和当前页面有关的东西，点一下预览立刻变，满意再保存（字体、配色、形状）或交给 AI（组件、动效）。 */
export function PolishPanel(panel: PanelProps) {
	const { locale, preview, project, callModule } = panel;
	const s = STRINGS[locale];
	const [draft, setDraft] = usePolishDraft(project.dir);
	const polish = usePolishStatus(callModule);
	const page = useInspection(preview);
	const tokens = useMemo(() => tokenDraft(draft), [draft]);
	const layers = useMemo(() => desiredLayers(draft, page.inspection), [draft, page.inspection]);
	const sync = usePreviewSync(preview, layers, tokens.fontImports ?? []);

	const status = polish.status.state === "ready" ? polish.status.status : undefined;
	const tokenNote = !preview.ready ? s.needsPreview : !status?.organized ? s.needsOrganize : undefined;
	const pageNote = preview.ready ? undefined : s.needsPreview;
	const tokenProps = { locale, draft, setDraft, saved: status?.values ?? {}, disabled: Boolean(tokenNote), note: tokenNote };
	const pageProps = { panel, draft, setDraft, ...page, onReinspect: page.run, disabled: Boolean(pageNote), note: pageNote };

	return (
		<div className="flex flex-1 flex-col">
			<nav aria-label={s.sections} className="sticky top-0 z-10 flex gap-0.5 overflow-x-auto border-b border-line bg-app px-2 py-1">
				{NAV.map(([id, key]) => (
					<button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })} className="h-6 shrink-0 rounded-md px-2 text-xs text-muted hover:bg-hover hover:text-fg">
						{s[key]}
					</button>
				))}
			</nav>

			<div className="flex-1 space-y-6 p-3">
				{!preview.ready && <Notice>{project.previewUrl ? s.previewConnecting : s.previewNotRunning}</Notice>}
				{sync.error && <Notice tone="danger">{s.previewFailed(sync.error)}</Notice>}
				<StatusCard panel={panel} polish={polish} />
				<FontSection {...tokenProps} />
				<ColorSection {...tokenProps} />
				<ShapeSection {...tokenProps} />
				<ComponentsSection {...pageProps} />
				<MotionSection {...pageProps} />
				<section id="polish-references" aria-label={s.references} className="scroll-mt-12 space-y-2">
					<h3 className="font-semibold">{s.references}</h3>
					<SimilarProducts panel={panel} compact />
				</section>
			</div>

			<SaveBar panel={panel} draft={draft} setDraft={setDraft} polish={polish} tokens={tokens} clearPreview={sync.clearAll} />
		</div>
	);
}

type Polish = ReturnType<typeof usePolishStatus>;

function StatusCard({ panel, polish }: { panel: PanelProps; polish: Polish }) {
	const s = STRINGS[panel.locale];
	const { status, organize } = polish;
	if (status.state === "loading")
		return (
			<p className="flex items-center gap-2 text-xs text-muted">
				<Spinner /> {s.statusLoading}
			</p>
		);
	if (status.state === "error")
		return (
			<Notice tone="danger" action={<TextButton onClick={polish.load}>{s.retry}</TextButton>}>
				{s.statusFailed(status.message)}
			</Notice>
		);
	if (organize.state === "done") return <OrganizedCard locale={panel.locale} result={organize.result} />;
	if (status.status.organized) return null;

	const running = organize.state === "running";
	const last = running ? organize.progress.at(-1) : undefined;
	const step = last && (last.phase === "tool" ? last.summary : last.phase === "text" ? last.text : s.organizePhase[last.phase]);
	return (
		<div className="space-y-2 rounded-lg bg-panel p-3 ring-1 ring-line">
			<h3 className="flex items-center gap-1.5 font-semibold">
				<Wand2 size={15} aria-hidden className="text-accent" />
				{s.organizeTitle}
			</h3>
			<p className="text-xs text-pretty text-muted">{s.organizeBody}</p>
			{organize.state === "error" && <Notice tone="danger">{s.organizeFailed(organize.message)}</Notice>}
			<div className="flex items-center gap-2">
				<Button variant="primary" disabled={running} onClick={polish.runOrganize}>
					{running && <Spinner />}
					{running ? s.organizing : s.organize}
				</Button>
				{step && (
					<span role="status" className="min-w-0 flex-1 truncate text-xs text-muted">
						{step}
					</span>
				)}
			</div>
		</div>
	);
}

function OrganizedCard({ locale, result }: { locale: PanelProps["locale"]; result: NonNullable<Extract<Polish["organize"], { state: "done" }>["result"]> }) {
	const s = STRINGS[locale];
	const appearance = result.appearanceUnchanged === undefined ? s.appearanceUnknown : result.appearanceUnchanged ? s.appearanceSame : s.appearanceChanged;
	return (
		<div role="status" className="space-y-1 rounded-lg bg-panel p-3 ring-1 ring-line">
			<h3 className="flex items-center gap-1.5 font-semibold">
				<Check size={15} aria-hidden className="text-success" />
				{s.organizedTitle}
			</h3>
			{result.summary && <p className="text-xs text-pretty">{result.summary}</p>}
			<p className={`flex items-center gap-1 text-xs ${result.appearanceUnchanged === false ? "text-warning" : "text-muted"}`}>
				{result.appearanceUnchanged === false && <CircleAlert size={13} aria-hidden />}
				{appearance}
			</p>
			{result.changedFiles.length > 0 && (
				<details className="text-xs text-muted">
					<summary className="cursor-pointer">{s.changedFiles(result.changedFiles.length)}</summary>
					<ul className="mt-1 space-y-0.5 font-mono">
						{result.changedFiles.map((f) => (
							<li key={f} className="truncate">
								{f}
							</li>
						))}
					</ul>
				</details>
			)}
		</div>
	);
}

type SaveBarProps = {
	panel: PanelProps;
	draft: PolishDraft;
	setDraft: (update: (d: PolishDraft) => PolishDraft) => void;
	polish: Polish;
	tokens: ReturnType<typeof tokenDraft>;
	clearPreview: () => Promise<void>;
};

function SaveBar({ panel, draft, setDraft, polish, tokens, clearPreview }: SaveBarProps) {
	const { locale, callModule, preview } = panel;
	const s = STRINGS[locale];
	const [state, setState] = useState<{ state: "idle" | "saving" | "saved" } | { state: "error"; message: string }>({ state: "idle" });
	const status = polish.status.state === "ready" ? polish.status.status : undefined;
	const count = changeCount(draft);
	const tokenCount = tokenChangeCount(draft);
	const trials = count - tokenCount;
	// 又有新的改动时收起“已保存”
	useEffect(() => {
		if (tokenCount > 0) setState((st) => (st.state === "saved" ? { state: "idle" } : st));
	}, [tokenCount]);

	const save = async () => {
		if (!status) return;
		setState({ state: "saving" });
		try {
			const payload = savePayload(tokens, status);
			if (Object.keys(payload.values).length || payload.fontImports) polish.setStatus({ state: "ready", status: await callModule<PolishApi, "saveTokens">("polish", "saveTokens", payload) });
			setDraft((d) => ({ ...d, font: undefined, palette: undefined, primary: undefined, shape: {} }));
			setState({ state: "saved" });
		} catch (e) {
			setState({ state: "error", message: e instanceof Error ? e.message : String(e) });
		}
	};
	const resetAll = async () => {
		setState({ state: "idle" });
		try {
			if (preview.ready) await clearPreview();
			setDraft(() => EMPTY_DRAFT);
		} catch (e) {
			setState({ state: "error", message: e instanceof Error ? e.message : String(e) });
		}
	};

	return (
		<div className="sticky bottom-0 z-10 space-y-1 border-t border-line bg-app px-3 py-2">
			{state.state === "error" && <p className="text-xs text-danger">{s.saveFailed(state.message)}</p>}
			{state.state === "saved" && <p className="text-xs text-success">{s.saved}</p>}
			{trials > 0 && <p className="text-xs text-muted">{s.aiOnly}</p>}
			<div className="flex items-center gap-2">
				<span role="status" className="min-w-0 flex-1 truncate text-xs">
					<span className={count ? "text-fg" : "text-muted"}>{s.unsaved(count)}</span>
				</span>
				<Button variant="ghost" disabled={count === 0} onClick={resetAll}>
					{s.resetAll}
				</Button>
				<Button variant="primary" disabled={tokenCount === 0 || !status?.organized || state.state === "saving"} onClick={save}>
					{state.state === "saving" && <Spinner />}
					{state.state === "saving" ? s.saving : s.save}
				</Button>
			</div>
		</div>
	);
}
