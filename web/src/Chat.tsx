import { useEffect, useRef, useState } from "react";
import type { T } from "./i18n.ts";
import type { ChatItem } from "./useWorkspace.ts";

function Item({ item, t }: { item: ChatItem; t: T }) {
	switch (item.kind) {
		case "user":
			return (
				<div className="self-end max-w-[85%] rounded-lg bg-stone-900 px-3 py-2 text-white">
					{item.image && <img src={item.image} alt={t.circledImage} className="mb-2 rounded" />}
					<p className="whitespace-pre-wrap">{item.text}</p>
				</div>
			);
		case "assistant":
			return <p className="whitespace-pre-wrap text-stone-800">{item.text}</p>;
		case "tool":
			return (
				<p className="truncate font-mono text-xs text-stone-500">
					{item.status === "running" ? "…" : item.status === "error" ? "✗" : "✓"} {item.name} {item.summary}
				</p>
			);
		case "error":
			return <p className="whitespace-pre-wrap rounded bg-red-50 px-3 py-2 text-sm text-red-700">{item.text}</p>;
	}
}

export function Chat(props: { t: T; items: ChatItem[]; busy: boolean; enabled: boolean; onSend: (text: string) => void; onStop: () => void }) {
	const { t, items, busy, enabled } = props;
	const [draft, setDraft] = useState("");
	const end = useRef<HTMLDivElement>(null);
	useEffect(() => {
		end.current?.scrollIntoView({ block: "end" });
	}, [items]);

	const submit = () => {
		const text = draft.trim();
		if (!text) return;
		props.onSend(text);
		setDraft("");
	};

	return (
		<section className="flex min-h-0 flex-col border-r border-stone-200">
			<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 text-sm">
				{items.map((item, i) => (
					<Item key={i} item={item} t={t} />
				))}
				{busy && <p className="text-xs text-stone-400">{t.thinking}</p>}
				<div ref={end} />
			</div>
			<form
				className="flex gap-2 border-t border-stone-200 p-3"
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<textarea
					value={draft}
					disabled={!enabled}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault();
							submit();
						}
					}}
					placeholder={t.chatPlaceholder}
					rows={2}
					className="flex-1 resize-none rounded border border-stone-300 px-2 py-1 text-sm disabled:bg-stone-100"
				/>
				{busy ? (
					<button type="button" onClick={props.onStop} className="rounded bg-stone-200 px-3 text-sm">
						{t.stop}
					</button>
				) : (
					<button type="submit" disabled={!enabled} className="rounded bg-stone-900 px-3 text-sm text-white disabled:opacity-40">
						{t.send}
					</button>
				)}
			</form>
		</section>
	);
}
