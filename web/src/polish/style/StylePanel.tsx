import { useEffect, useRef, useState } from "react";
import type { StyleApi } from "../../../../server/modules/style.ts";
import type { StylePlan, StyleReference } from "../../../../server/modules/style-plan.ts";
import type { PanelProps, PreviewControl } from "../../panels.ts";
import { SimilarProducts } from "../../references/SimilarProducts.tsx";
import { Button, Spinner } from "../../ui.tsx";
import { STRINGS } from "./strings.ts";
import { StyleTrial } from "./trial.ts";
import { onPreviewPageChanged } from "./lifecycle.ts";

export function StylePanel({ panel }: { panel: PanelProps }) {
	return <PageStyle key={`${panel.project.dir}:${panel.project.previewUrl}`} panel={panel} />;
}

function PageStyle({ panel }: { panel: PanelProps }) {
	const s = STRINGS[panel.locale];
	const latest = useRef(panel);
	latest.current = panel;
	const [trial] = useState(() => {
		const preview: PreviewControl = {
			ready: true,
			inspect: () => latest.current.preview.inspect(),
			applyLayer: (id, css) => latest.current.preview.applyLayer(id, css),
			clearLayer: (id) => latest.current.preview.clearLayer(id),
			clearAll: () => latest.current.preview.clearAll(),
			loadFonts: (urls) => latest.current.preview.loadFonts(urls),
			readTokens: () => latest.current.preview.readTokens(),
		};
		return new StyleTrial(preview, (submission) => latest.current.submitToAi(submission));
	});
	const [reference, setReference] = useState<StyleReference>();
	const [plan, setPlan] = useState<StylePlan>();
	const [working, setWorking] = useState(false);
	const [error, setError] = useState("");
	const generation = useRef(0);
	const attempted = useRef(false);

	useEffect(() => {
		if (!panel.project.previewUrl) return;
		const unsubscribe = onPreviewPageChanged(panel.project.previewUrl, () => {
			++generation.current;
			trial.invalidate();
			setPlan(undefined);
			setWorking(false);
			if (attempted.current) setError(STRINGS[latest.current.locale].changed);
			attempted.current = false;
		});
		return () => {
			unsubscribe();
			++generation.current;
			trial.cancel().catch((error: unknown) => console.error("Style preview cleanup failed", error));
		};
	}, [panel.project.previewUrl, trial]);

	const run = async () => {
		if (!reference) return;
		const id = ++generation.current;
		attempted.current = true;
		setWorking(true);
		setError("");
		setPlan(undefined);
		try {
			const result = await trial.try(reference, (page) => panel.callModule<StyleApi, "propose">("style", "propose", { page, reference, locale: panel.locale }));
			if (id === generation.current) {
				setPlan(result);
				if (!result) setError(s.changed);
			}
		} catch (e) {
			if (id === generation.current) setError(`${s.failed}: ${String(e)}`);
		} finally {
			if (id === generation.current) setWorking(false);
		}
	};
	const cancel = async () => {
		++generation.current;
		attempted.current = false;
		setWorking(true);
		setPlan(undefined);
		try { await trial.cancel(); setError(""); } catch (e) { setError(String(e)); }
		finally { setWorking(false); }
	};
	const confirm = async () => {
		setWorking(true);
		setError("");
		try { await trial.confirm(); setPlan(undefined); panel.showChat(); }
		catch (e) { setPlan(undefined); setError(String(e)); }
		finally { setWorking(false); }
	};

	return <section className="space-y-3 p-3" aria-label={panel.locale === "zh" ? "风格试用" : "Style trial"}>
		<p className="text-xs text-muted">{s.intro}</p>
		{!panel.preview.ready && <p role="status" className="text-xs text-muted">{s.unavailable}</p>}
		{error && <p role="alert" className="text-xs text-danger break-words">{error}</p>}
		{!reference ? <SimilarProducts panel={panel} compact choice={{ label: s.choose, onChoose: setReference }} /> : <>
			<img src={`data:image/jpeg;base64,${reference.image}`} alt={reference.name} className="w-full rounded border border-line" />
			<p className="truncate text-sm" title={reference.url}>{reference.name}</p>
			{plan && <div className="space-y-2" role="status"><p className="text-xs text-muted">{s.trial}</p><p className="text-sm">{plan.summary}</p></div>}
			<p className="text-xs text-muted">{s.notice}</p>
			<div className="flex flex-col gap-2">
				{plan ? <Button variant="primary" disabled={working || panel.busy || !panel.preview.ready} onClick={confirm}>{s.confirm}</Button>
					: <Button variant="primary" disabled={working || !panel.preview.ready} onClick={run}>{working ? <><Spinner />{s.generating}</> : s.preview}</Button>}
				{(working || plan || error) && <Button onClick={cancel} disabled={!panel.preview.ready}>{s.cancel}</Button>}
				{!working && !plan && <Button onClick={() => setReference(undefined)}>{s.change}</Button>}
			</div>
		</>}
	</section>;
}
