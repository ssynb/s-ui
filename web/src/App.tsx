import { useState } from "react";
import { Chat } from "./Chat.tsx";
import { useI18n } from "./i18n.ts";
import { Preview } from "./Preview.tsx";
import { useWorkspace } from "./useWorkspace.ts";

export function App() {
	const { t, toggle } = useI18n();
	const { state, selectModel, open, prompt, abort } = useWorkspace();
	const [dir, setDir] = useState("");

	return (
		<div className="flex h-screen flex-col text-stone-900">
			<header className="flex items-center gap-2 border-b border-stone-200 px-3 py-2 text-sm">
				<strong className="mr-2">s-ui</strong>
				<form
					className="flex flex-1 gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (dir.trim()) open(dir);
					}}
				>
					<input
						value={dir}
						onChange={(e) => setDir(e.target.value)}
						placeholder={t.folderPlaceholder}
						className="flex-1 rounded border border-stone-300 px-2 py-1 font-mono"
					/>
					<button type="submit" disabled={!state.model} className="rounded bg-stone-900 px-3 text-white disabled:opacity-40">
						{t.open}
					</button>
				</form>
				{state.exampleDir && (
					<button
						onClick={() => {
							setDir(state.exampleDir!);
							open(state.exampleDir!);
						}}
						className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100"
					>
						{t.openExample}
					</button>
				)}
				<label className="flex items-center gap-1 text-stone-600">
					{t.model}
					<select value={state.model ?? ""} onChange={(e) => selectModel(e.target.value)} className="rounded border border-stone-300 px-1 py-1">
						{state.models.map((m) => (
							<option key={m.id} value={m.id}>
								{m.label}
							</option>
						))}
					</select>
				</label>
				<button onClick={toggle} className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100">
					{t.language}
				</button>
			</header>
			{!state.connected && state.models.length > 0 && <p className="bg-red-50 px-3 py-1 text-sm text-red-700">{t.disconnected}</p>}
			<main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,30%)_1fr]">
				<Chat t={t} items={state.items} busy={state.busy} enabled={Boolean(state.sessionId)} onSend={(text) => prompt(text)} onStop={abort} />
				<Preview t={t} preview={state.preview} onAnnotate={prompt} />
			</main>
		</div>
	);
}
