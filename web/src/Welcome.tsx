import { FolderOpen, Plus, Sparkle } from "lucide-react";
import type { T } from "./i18n.ts";
import { projectName, shortenPath } from "./paths.ts";
import { ProjectIcon } from "./ui.tsx";

type Props = {
	t: T;
	home?: string;
	recentProjects: string[];
	exampleDir?: string;
	onOpen: (dir: string) => void;
	onOpenFolder: () => void;
	onNewProject: () => void;
};

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} className="flex h-8 w-full items-center gap-2.5 rounded-md bg-hover/60 px-3 text-left hover:bg-hover">
			<span className="text-muted">{icon}</span>
			{label}
		</button>
	);
}

/** 未打开项目时的欢迎页，结构参照 IDEA：左侧动作，右侧最近项目。 */
export function Welcome({ t, home, recentProjects, exampleDir, onOpen: open, onOpenFolder, onNewProject }: Props) {
	return (
		<main className="flex min-h-0 flex-1 bg-panel">
			<section className="flex w-72 shrink-0 flex-col gap-1.5 border-r border-line bg-app p-4">
				<h1 className="text-lg font-semibold">s-ui</h1>
				<p className="mb-4 text-muted">{t.tagline}</p>
				<Action icon={<FolderOpen size={16} />} label={t.openFolder} onClick={onOpenFolder} />
				<Action icon={<Plus size={16} />} label={t.newProject} onClick={onNewProject} />
				{exampleDir && <Action icon={<Sparkle size={16} />} label={t.tryExample} onClick={() => open(exampleDir)} />}
			</section>
			<section aria-labelledby="recent-heading" className="flex min-w-0 flex-1 flex-col p-4">
				{recentProjects.length === 0 ? (
					<div className="m-auto max-w-sm text-center">
						<h2 id="recent-heading" className="font-semibold">
							{t.noRecent}
						</h2>
						<p className="mt-1 text-muted">{t.noRecentHint}</p>
					</div>
				) : (
					<>
						<h2 id="recent-heading" className="px-2 pb-2 font-semibold">
							{t.recentProjects}
						</h2>
						<ul className="min-h-0 space-y-0.5 overflow-y-auto">
							{recentProjects.map((dir) => (
								<li key={dir}>
									<button type="button" onClick={() => open(dir)} className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-hover">
										<ProjectIcon name={projectName(dir)} size={28} />
										<span className="min-w-0">
											<span className="block truncate font-medium">{projectName(dir)}</span>
											<span className="block truncate text-xs text-muted" title={dir}>
												{shortenPath(dir, home)}
											</span>
										</span>
									</button>
								</li>
							))}
						</ul>
					</>
				)}
			</section>
		</main>
	);
}
