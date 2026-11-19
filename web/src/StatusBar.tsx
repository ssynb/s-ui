import type { T } from "./i18n.ts";
import { Spinner } from "./ui.tsx";
import type { Preview } from "./useWorkspace.ts";

const DEV_STATE: Record<Preview["state"], { color: string; text: (t: T) => string }> = {
	ready: { color: "bg-success", text: (t) => t.devRunning },
	installing: { color: "bg-warning", text: (t) => t.devInstalling },
	starting: { color: "bg-warning", text: (t) => t.devStarting },
	error: { color: "bg-danger", text: (t) => t.devError },
	stopped: { color: "bg-danger", text: (t) => t.devStopped },
	missing: { color: "bg-warning", text: (t) => t.devError },
	empty: { color: "bg-faint", text: (t) => t.devEmpty },
};

type Props = { t: T; hasProject: boolean; preview?: Preview; model?: string; busy: boolean; connected: boolean };

/** 底部状态栏：左侧页面服务状态，右侧当前模型和 AI 会话状态。 */
export function StatusBar({ t, hasProject, preview, model, busy, connected }: Props) {
	const dev = preview && DEV_STATE[preview.state];
	return (
		<footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-app px-3 text-xs text-muted">
			{!connected ? (
				<span role="alert" className="text-danger">
					{t.disconnected}
				</span>
			) : !hasProject ? (
				<span>{t.noProject}</span>
			) : (
				dev && (
					<span className="flex min-w-0 items-center gap-1.5">
						<span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dev.color}`} />
						<span className="shrink-0">{dev.text(t)}</span>
						{preview.url && <span className="truncate font-mono text-faint">{preview.url}</span>}
					</span>
				)
			)}
			<span className="flex-1" />
			{hasProject && (
				<>
					<span className="truncate">{model}</span>
					<span className="flex shrink-0 items-center gap-1.5">
						{busy && <Spinner />}
						{busy ? t.sessionBusy : t.sessionIdle}
					</span>
				</>
			)}
		</footer>
	);
}
