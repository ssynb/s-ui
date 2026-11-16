import { ArrowUp, Check, ChevronRight, Square, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { T } from "./i18n.ts";
import { IconButton, Spinner } from "./ui.tsx";
import type { ChatItem } from "./useWorkspace.ts";

type ToolItem = Extract<ChatItem, { kind: "tool" }>;
type Block = { kind: "item"; item: Exclude<ChatItem, ToolItem> } | { kind: "tools"; tools: ToolItem[] };

/** 连续的工具调用合并成一块，折叠成一行显示。 */
function toBlocks(items: ChatItem[]): Block[] {
	const blocks: Block[] = [];
	for (const item of items) {
		const last = blocks.at(-1);
		if (item.kind !== "tool") blocks.push({ kind: "item", item });
		else if (last?.kind === "tools") last.tools.push(item);
		else blocks.push({ kind: "tools", tools: [item] });
	}
	return blocks;
}

function ToolStatus({ status }: { status: ToolItem["status"] }) {
	if (status === "running") return <Spinner className="text-accent" />;
	if (status === "error") return <X size={14} className="text-danger" />;
	return <Check size={14} className="text-success" />;
}

function ToolGroup({ t, tools }: { t: T; tools: ToolItem[] }) {
	const last = tools.at(-1)!;
	const status = tools.some((x) => x.status === "running") ? "running" : tools.some((x) => x.status === "error") ? "error" : "done";
	return (
		<details className="group">
			<summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
				<ChevronRight size={14} className="shrink-0 group-open:rotate-90" />
				<ToolStatus status={status} />
				<span className="shrink-0">{t.toolsSummary(tools.length)}</span>
				<span className="truncate font-mono text-xs text-faint">
					{last.name} {last.summary}
				</span>
			</summary>
			<ul className="mt-0.5 ml-5 space-y-0.5 border-l border-line pl-3">
				{tools.map((tool) => (
					<li key={tool.id} className="flex items-center gap-1.5 font-mono text-xs text-muted">
						<ToolStatus status={tool.status} />
						<span className="shrink-0 text-fg">{tool.name}</span>
						<span className="truncate" title={tool.summary}>
							{tool.summary}
						</span>
					</li>
				))}
			</ul>
		</details>
	);
}

function Message({ t, item }: { t: T; item: Exclude<ChatItem, ToolItem> }) {
	switch (item.kind) {
		case "user":
			return (
				<div className="rounded-lg bg-hover/70 px-3 py-2">
					{item.image && <img src={item.image} alt={t.circledImage} className="mb-2 rounded-md ring-1 ring-line" />}
					<p className="whitespace-pre-wrap">{item.text}</p>
				</div>
			);
		case "assistant":
			return (
				<div className="md px-1 leading-relaxed [overflow-wrap:anywhere]">
					<Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
				</div>
			);
		case "error":
			return (
				<p role="alert" className="rounded-md bg-danger/10 px-3 py-2 whitespace-pre-wrap text-danger">
					{item.text}
				</p>
			);
	}
}

const STICK_THRESHOLD_PX = 48;

/** 只在用户停留在底部时跟随新内容；往上翻看时不打扰。 */
function useFollowLatest(deps: unknown) {
	const ref = useRef<HTMLDivElement>(null);
	const stick = useRef(true);
	useLayoutEffect(() => {
		const el = ref.current;
		if (el && stick.current) el.scrollTop = el.scrollHeight;
	}, [deps]);
	const onScroll = () => {
		const el = ref.current!;
		stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
	};
	return { ref, onScroll };
}

type ChatProps = { t: T; items: ChatItem[]; busy: boolean; onSend: (text: string) => void; onStop: () => void };

export function Chat({ t, items, busy, onSend, onStop }: ChatProps) {
	const [draft, setDraft] = useState("");
	const scroller = useFollowLatest(items);
	const streaming = items.at(-1)?.kind === "assistant";

	const submit = () => {
		const text = draft.trim();
		if (!text) return;
		onSend(text);
		setDraft("");
	};

	return (
		<section aria-labelledby="chat-title" className="flex min-h-0 flex-col border-r border-line bg-app">
			<h2 id="chat-title" className="flex h-9 shrink-0 items-center px-3 font-semibold">
				{t.chatTitle}
			</h2>
			<div ref={scroller.ref} onScroll={scroller.onScroll} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
				{toBlocks(items).map((block, i) =>
					block.kind === "tools" ? <ToolGroup key={i} t={t} tools={block.tools} /> : <Message key={i} t={t} item={block.item} />,
				)}
				{busy && !streaming && <Spinner className="ml-1 text-muted" />}
			</div>
			<form
				className="m-2 mt-0 rounded-lg bg-panel ring-1 ring-line focus-within:ring-accent"
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault();
							submit();
						}
					}}
					aria-label={t.chatPlaceholder}
					placeholder={t.chatPlaceholder}
					rows={3}
					className="block w-full resize-none bg-transparent px-3 pt-2.5 placeholder:text-faint focus:outline-none"
				/>
				<div className="flex items-center gap-2 px-2 pb-2">
					<span className="flex-1 truncate pl-1 text-xs text-faint">{t.sendHint}</span>
					{busy ? (
						<IconButton label={t.stop} onClick={onStop} className="bg-hover text-fg">
							<Square size={12} fill="currentColor" />
						</IconButton>
					) : (
						<IconButton type="submit" label={t.send} disabled={!draft.trim()} className="bg-accent text-white hover:bg-accent-hover hover:text-white">
							<ArrowUp size={16} />
						</IconButton>
					)}
				</div>
			</form>
		</section>
	);
}
