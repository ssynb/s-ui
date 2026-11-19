import { useRef, useState } from "react";
import type { Annotation } from "../../server/protocol.ts";
import { Chat } from "./Chat.tsx";
import { ConversationActions } from "./ConversationActions.tsx";
import type { Locale, T } from "./i18n.ts";
import type { AiSubmission, PanelProps } from "./panels.ts";
import { projectName } from "./paths.ts";
import { ProjectPages } from "./ProjectPages.tsx";
import { Button } from "./ui.tsx";
import { Preview } from "./Preview.tsx";
import { StartFromReference } from "./references/StartFromReference.tsx";
import { CHAT_WINDOW, ToolWindows } from "./ToolWindows.tsx";
import { usePreviewControl } from "./usePreviewControl.ts";
import type { useWorkspace } from "./useWorkspace.ts";

type Props = { onOpenFolder: () => void; t: T; locale: Locale; workspace: ReturnType<typeof useWorkspace> };

/** 打开项目后的工作区：左侧工具窗、右侧预览。圈选与当前工具窗属于这个项目，切换项目时随之重置。 */
export function Workspace({ t, locale, workspace, onOpenFolder }: Props) {
	const { state } = workspace;
	const [activeWindow, setActiveWindow] = useState(CHAT_WINDOW);
	const [selection, setSelection] = useState<Annotation>();
	const [choosingPage, setChoosingPage] = useState(false);
	const multiplePages = (state.preview?.pages?.length ?? 0) > 1;
	const showPages = multiplePages && (choosingPage || !state.preview?.selectedPage);
	const previewUrl = !showPages && state.preview?.state === "ready" ? state.preview.url : undefined;
	const frame = useRef<HTMLIFrameElement>(null);
	const preview = usePreviewControl(frame, previewUrl);

	// 对话框、画圈弹框和各工具窗面板交给 AI 的唯一入口。
	const submitToAi = ({ text, images, withSelection }: AiSubmission) => {
		const annotation = withSelection ? selection : undefined;
		workspace.prompt(text, { annotation, images });
		if (annotation) setSelection(undefined);
	};

	const panelProps: PanelProps = {
		locale,
		project: { dir: state.dir!, name: projectName(state.dir!), previewUrl },
		selection: selection && { elements: selection.capture.elements.map(({ selector, text, html }) => ({ selector, text, html })) },
		busy: state.busy,
		submitToAi,
		showChat: () => setActiveWindow(CHAT_WINDOW),
		callModule: workspace.callModule,
		preview,
	};

	return (
		<main className="grid min-h-0 flex-1 grid-cols-[minmax(360px,30%)_minmax(0,1fr)]">
			<ToolWindows
				t={t}
				locale={locale}
				active={activeWindow}
				onActivate={setActiveWindow}
				panelProps={panelProps}
				chatActions={
					<ConversationActions
						t={t}
						locale={locale}
						current={state.conversationId}
						conversations={state.conversations}
						onNew={workspace.newConversation}
						onSwitch={workspace.switchConversation}
					/>
				}
				chat={
					<Chat
						t={t}
						items={state.items}
						busy={state.busy}
						locked={state.exclusive && t.exclusive[state.exclusive]}
						onSend={(text) => submitToAi({ text })}
						onStop={workspace.abort}
					/>
				}
			/>
			{showPages ? (
				<ProjectPages
					t={t}
					locale={locale}
					pages={state.preview!.pages!}
					baseUrl={state.preview!.url!}
					capture={workspace.capturePage}
					select={async (path) => {
						await workspace.selectPage(path);
						setSelection(undefined);
						setChoosingPage(false);
					}}
				/>
			) : (
				<Preview
					t={t}
					preview={state.preview}
					onChoosePage={multiplePages ? () => { setSelection(undefined); setChoosingPage(true); } : undefined}
					selection={selection}
					onSelectionChange={setSelection}
					onSubmitSelection={(text) => submitToAi({ text, withSelection: true })}
					missing={
						<div className="flex h-full flex-col items-center justify-center gap-3">
							<p className="text-muted">{t.previewMissing}</p>
							<Button onClick={onOpenFolder}>{t.openFolder}</Button>
						</div>
					}
					empty={<StartFromReference panel={panelProps} defaultMessage={t.previewEmpty} />}
					frame={frame}
				/>
			)}
		</main>
	);
}
