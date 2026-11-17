import { MessageSquare } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Locale, T } from "./i18n.ts";
import { libraryPanel } from "./library/index.ts";
import type { PanelDefinition, PanelProps } from "./panels.ts";
import { referencesPanel } from "./references/index.ts";

/** 对话之外的工具窗，按在工具窗条上的顺序排列。新增工具窗：写一个 PanelDefinition，在这里加一项。 */
const PANELS: PanelDefinition[] = [libraryPanel, referencesPanel];

export const CHAT_WINDOW = "chat";

type Props = {
	t: T;
	locale: Locale;
	active: string;
	onActivate: (id: string) => void;
	chat: ReactNode;
	/** 对话工具窗标题栏右侧的操作（新对话、对话记录）。 */
	chatActions: ReactNode;
	panelProps: PanelProps;
};

/** JetBrains 式左侧工具窗：最左一列图标条切换，右侧显示当前工具窗。看过的工具窗保持挂载，切回来状态还在。 */
export function ToolWindows({ t, locale, active, onActivate, chat, chatActions, panelProps }: Props) {
	const [visited, setVisited] = useState(() => new Set([active]));
	if (!visited.has(active)) setVisited(new Set(visited).add(active));

	const windows = [
		{ id: CHAT_WINDOW, icon: MessageSquare, title: t.chatTitle, render: () => chat },
		...PANELS.map((p) => ({ id: p.id, icon: p.icon, title: p.title(locale), render: () => <p.Component {...panelProps} /> })),
	];
	const current = windows.find((w) => w.id === active)!;

	return (
		<div className="flex min-h-0 border-r border-line bg-app">
			<div role="tablist" aria-label={t.toolWindows} aria-orientation="vertical" className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-line py-1.5">
				{windows.map(({ id, icon: Icon, title }) => (
					<button
						key={id}
						type="button"
						role="tab"
						id={`tool-tab-${id}`}
						aria-selected={id === active}
						aria-controls={`tool-panel-${id}`}
						aria-label={title}
						title={title}
						onClick={() => onActivate(id)}
						className={`flex size-8 items-center justify-center rounded-md ${id === active ? "bg-selected text-accent" : "text-muted hover:bg-hover hover:text-fg"}`}
					>
						<Icon size={18} />
					</button>
				))}
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex h-9 shrink-0 items-center gap-1 pr-1.5 pl-3">
					<h2 className="flex-1 truncate font-semibold">{current.title}</h2>
					{active === CHAT_WINDOW && chatActions}
				</div>
				{windows
					.filter((w) => visited.has(w.id))
					.map((w) => (
						<div
							key={w.id}
							role="tabpanel"
							id={`tool-panel-${w.id}`}
							aria-labelledby={`tool-tab-${w.id}`}
							hidden={w.id !== active}
							className="flex min-h-0 flex-1 flex-col overflow-y-auto"
						>
							{w.render()}
						</div>
					))}
			</div>
		</div>
	);
}
