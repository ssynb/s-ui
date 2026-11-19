import { useEffect, useState } from "react";
import type { ProjectPageShot } from "../../server/protocol.ts";
import type { Locale, T } from "./i18n.ts";
import { CardGrid, ReferenceCard } from "./references/ReferenceCard.tsx";
import { ScreenshotView } from "./ScreenshotView.tsx";
import { Button, Spinner } from "./ui.tsx";

type Props = {
	t: T;
	locale: Locale;
	pages: string[];
	baseUrl: string;
	capture: (path: string) => Promise<ProjectPageShot>;
	select: (path: string) => Promise<unknown>;
};

export function ProjectPages({ t, locale, pages, baseUrl, capture, select }: Props) {
	const [shots, setShots] = useState<Record<string, ProjectPageShot>>({});
	const [opened, setOpened] = useState<string>();
	const [error, setError] = useState("");
	const [selecting, setSelecting] = useState(false);
	useEffect(() => {
		let active = true;
		// 逐页截图，避免 Next 同时编译所有路由及堆积浏览器进程。
		void (async () => {
			for (const path of pages) {
				const shot = await capture(path).catch((e: Error) => ({ error: e.message }));
				if (!active) return;
				setShots((previous) => ({ ...previous, [path]: shot }));
			}
		})();
		return () => { active = false; };
	}, [capture, pages]);

	const choose = async () => {
		setSelecting(true);
		setError("");
		try {
			await select(opened!);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSelecting(false);
		}
	};

	return (
		<section aria-label={t.choosePage} className="min-h-0 flex-1 overflow-auto bg-panel p-4">
			<h2 className="mb-4 font-medium">{t.choosePage}</h2>
			<CardGrid>
				{pages.map((path) => (
					<ReferenceCard
						key={path}
						openLabel={t.openPage(path)}
						locale={locale}
						allowUnavailable
						compact
						card={{ name: path, url: new URL(path, baseUrl).href, why: "", image: shots[path]?.image, failed: shots[path]?.error ? t.shotFailed : undefined }}
						onOpen={() => setOpened(path)}
					/>
				))}
			</CardGrid>
			{opened && (
				<ScreenshotView closeLabel={t.cancel} title={opened} image={shots[opened]?.image} onClose={() => setOpened(undefined)}>
					{!shots[opened] && <Spinner />}
					{shots[opened]?.error && <p className="text-muted">{t.shotFailed}: {shots[opened]?.error}</p>}
					{error && <p role="alert" className="text-danger">{error}</p>}
					<Button variant="primary" disabled={selecting} onClick={() => void choose()}>{t.selectPage}</Button>
				</ScreenshotView>
			)}
		</section>
	);
}
