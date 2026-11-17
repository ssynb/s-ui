import { ChevronDown, FolderOpen, Languages, Plus, Sparkles, Square } from "lucide-react";
import type { ModelInfo } from "../../server/protocol.ts";
import type { T } from "./i18n.ts";
import { projectName, shortenPath } from "./paths.ts";
import { IconButton, Menu, MenuItem, MenuLabel, MenuSeparator, ProjectIcon, Spinner } from "./ui.tsx";

type ProjectMenuProps = {
	t: T;
	dir?: string;
	home?: string;
	recentProjects: string[];
	onOpen: (dir: string) => void;
	onOpenFolder: () => void;
	onNewProject: () => void;
};

/** IDEA 式项目切换：当前项目名 ▾，下拉里是最近项目和打开/新建。 */
function ProjectMenu({ t, dir, home, recentProjects, onOpen, onOpenFolder, onNewProject }: ProjectMenuProps) {
	const name = dir ? projectName(dir) : undefined;
	return (
		<Menu
			buttonLabel={name ? `${name}, ${t.chooseProject}` : t.chooseProject}
			button={
				<>
					{name ? <ProjectIcon name={name} /> : <FolderOpen size={16} className="text-muted" />}
					<span className="truncate font-semibold">{name ?? t.chooseProject}</span>
					<ChevronDown size={14} className="shrink-0 text-muted" />
				</>
			}
		>
			{(close) => (
				<>
					{recentProjects.length > 0 && <MenuLabel>{t.recentProjects}</MenuLabel>}
					{recentProjects.map((path) => (
						<MenuItem
							key={path}
							selected={path === dir}
							onSelect={() => {
								close();
								onOpen(path);
							}}
						>
							<ProjectIcon name={projectName(path)} />
							<span className="min-w-0">
								<span className="block truncate">{projectName(path)}</span>
								<span className="block truncate text-xs text-muted">{shortenPath(path, home)}</span>
							</span>
						</MenuItem>
					))}
					{recentProjects.length > 0 && <MenuSeparator />}
					<MenuItem
						onSelect={() => {
							close();
							onOpenFolder();
						}}
					>
						<FolderOpen size={16} className="text-muted" />
						{t.openFolder}
					</MenuItem>
					<MenuItem
						onSelect={() => {
							close();
							onNewProject();
						}}
					>
						<Plus size={16} className="text-muted" />
						{t.newProject}
					</MenuItem>
				</>
			)}
		</Menu>
	);
}

function ModelMenu({ t, models, model, onSelect }: { t: T; models: ModelInfo[]; model?: string; onSelect: (id: string) => void }) {
	return (
		<Menu
			align="right"
			title={t.modelHint}
			buttonLabel={`${t.model}: ${model ?? ""}`}
			button={
				<>
					<Sparkles size={14} className="shrink-0 text-muted" />
					<span className="truncate">{model}</span>
					<ChevronDown size={14} className="shrink-0 text-muted" />
				</>
			}
		>
			{(close) =>
				models.map((m) => (
					<MenuItem
						key={m.id}
						selected={m.id === model}
						onSelect={() => {
							close();
							onSelect(m.id);
						}}
					>
						{m.label}
					</MenuItem>
				))
			}
		</Menu>
	);
}

type ToolbarProps = ProjectMenuProps & {
	models: ModelInfo[];
	model?: string;
	sessionModel?: string;
	busy: boolean;
	onSelectModel: (id: string) => void;
	onStop: () => void;
	onToggleLanguage: () => void;
};

export function Toolbar(props: ToolbarProps) {
	const { t, busy, sessionModel } = props;
	return (
		<header className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-app px-2">
			<ProjectMenu {...props} />
			<div className="flex-1" />
			{busy && (
				<div role="status" className="flex items-center gap-1.5 pr-1 text-muted">
					<Spinner className="text-accent" />
					<span>{t.sessionBusy}</span>
					<IconButton label={t.stop} onClick={props.onStop}>
						<Square size={12} fill="currentColor" className="text-danger" />
					</IconButton>
				</div>
			)}
			<ModelMenu t={t} models={props.models} model={sessionModel ?? props.model} onSelect={props.onSelectModel} />
			<IconButton label={t.languageLabel} onClick={props.onToggleLanguage} className="w-auto gap-1 px-2 text-[13px]">
				<Languages size={16} />
				{t.language}
			</IconButton>
		</header>
	);
}
