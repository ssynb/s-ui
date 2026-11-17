import { X } from "lucide-react";
import { useState } from "react";
import { FolderPicker } from "./FolderPicker.tsx";
import { errorText, useI18n } from "./i18n.ts";
import { NewProjectDialog } from "./NewProjectDialog.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { IconButton } from "./ui.tsx";
import { type RequestError, useWorkspace } from "./useWorkspace.ts";
import { Welcome } from "./Welcome.tsx";
import { Workspace } from "./Workspace.tsx";

type DialogState = { kind: "open" } | { kind: "new" | "chooseParent"; parent: string; name: string };

export function App() {
	const { t, locale, toggle } = useI18n();
	const workspace = useWorkspace();
	const { state } = workspace;
	const [dialog, setDialog] = useState<DialogState>();
	const [notice, setNotice] = useState("");
	const home = state.home ?? "";

	const openFolder = () => setDialog({ kind: "open" });
	const newProject = () => setDialog({ kind: "new", parent: home, name: "" });
	const close = () => setDialog(undefined);
	const openProject = (dir: string) => {
		setNotice("");
		workspace.open(dir).catch((e: RequestError) => setNotice(errorText(t, e)));
	};

	return (
		<div className="flex h-full flex-col">
			<Toolbar
				t={t}
				dir={state.dir}
				home={state.home}
				recentProjects={state.recentProjects}
				models={state.models}
				model={state.model}
				sessionModel={state.sessionModel}
				busy={state.busy}
				onOpen={openProject}
				onOpenFolder={openFolder}
				onNewProject={newProject}
				onSelectModel={workspace.chooseModel}
				onStop={workspace.abort}
				onToggleLanguage={toggle}
			/>
			{notice && (
				<p role="alert" className="flex items-center gap-2 border-b border-line bg-danger/10 px-3 py-1 text-danger">
					<span className="flex-1">{notice}</span>
					<IconButton label={t.cancel} onClick={() => setNotice("")} className="size-6">
						<X size={14} />
					</IconButton>
				</p>
			)}
			{state.sessionId ? (
				<Workspace key={state.sessionId} t={t} locale={locale} workspace={workspace} />
			) : (
				<Welcome
					t={t}
					home={state.home}
					recentProjects={state.recentProjects}
					exampleDir={state.exampleDir}
					onOpen={openProject}
					onOpenFolder={openFolder}
					onNewProject={newProject}
				/>
			)}
			<StatusBar t={t} hasProject={Boolean(state.sessionId)} preview={state.preview} model={state.sessionModel} busy={state.busy} connected={state.connected} />

			{dialog?.kind === "open" && (
				<FolderPicker
					t={t}
					title={t.openFolderTitle}
					confirmLabel={t.open}
					initialPath={state.dir ?? home}
					places={state.places}
					listFolder={workspace.listFolder}
					onConfirm={async (path) => {
						await workspace.open(path);
						close();
					}}
					onClose={close}
				/>
			)}
			{dialog?.kind === "new" && (
				<NewProjectDialog
					t={t}
					parent={dialog.parent}
					name={dialog.name}
					home={state.home}
					onNameChange={(name) => setDialog({ ...dialog, name })}
					onChangeParent={() => setDialog({ ...dialog, kind: "chooseParent" })}
					onCreate={async (parent, name) => {
						await workspace.createProject(parent, name);
						close();
					}}
					onClose={close}
				/>
			)}
			{dialog?.kind === "chooseParent" && (
				<FolderPicker
					t={t}
					title={t.chooseLocationTitle}
					confirmLabel={t.choose}
					initialPath={dialog.parent}
					places={state.places}
					listFolder={workspace.listFolder}
					onConfirm={(path) => setDialog({ ...dialog, kind: "new", parent: path })}
					onClose={() => setDialog({ ...dialog, kind: "new" })}
				/>
			)}
		</div>
	);
}
