import { ArrowUp, ChevronRight, FileText, Folder, FolderCode, HardDrive, House, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FolderEntry, FolderListing, Place } from "../../server/protocol.ts";
import { errorText, type T } from "./i18n.ts";
import { Button, IconButton, Modal } from "./ui.tsx";
import type { RequestError } from "./useWorkspace.ts";

const PLACE_ICONS = { home: House, desktop: Monitor, documents: FileText, drive: HardDrive };

type ListFolder = (path: string) => Promise<FolderListing>;

type NodeProps = {
	t: T;
	entry: FolderEntry;
	depth: number;
	selected?: string;
	listFolder: ListFolder;
	onSelect: (path: string) => void;
	onConfirm: (path: string) => void;
	onError: (error: RequestError) => void;
};

/** 目录树的一行；展开时才向后台要子文件夹。 */
function FolderNode({ t, entry, depth, selected, listFolder, onSelect, onConfirm, onError }: NodeProps) {
	const [children, setChildren] = useState<FolderEntry[]>();
	const [expanded, setExpanded] = useState(false);
	const toggle = async () => {
		if (!expanded && !children) {
			try {
				setChildren((await listFolder(entry.path)).entries);
			} catch (e) {
				return onError(e as RequestError);
			}
		}
		setExpanded((e) => !e);
	};
	const isSelected = entry.path === selected;
	const Icon = entry.isProject ? FolderCode : Folder;

	return (
		<li role="treeitem" aria-expanded={expanded} aria-selected={isSelected}>
			<div
				onClick={() => onSelect(entry.path)}
				onDoubleClick={() => (entry.isProject ? onConfirm(entry.path) : toggle())}
				onKeyDown={(e) => {
					if (e.key === "Enter") onConfirm(entry.path);
					if (e.key === "ArrowRight" && !expanded) toggle();
					if (e.key === "ArrowLeft" && expanded) toggle();
				}}
				tabIndex={0}
				className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-2 ${isSelected ? "bg-selected" : "hover:bg-hover"}`}
				style={{ paddingLeft: 4 + depth * 16 }}
			>
				<button
					type="button"
					tabIndex={-1}
					aria-label={entry.name}
					onClick={(e) => {
						e.stopPropagation();
						toggle();
					}}
					className="flex size-5 items-center justify-center rounded text-muted hover:text-fg"
				>
					<ChevronRight size={14} className={expanded ? "rotate-90" : ""} />
				</button>
				<Icon size={16} className={entry.isProject ? "shrink-0 text-accent" : "shrink-0 text-muted"} />
				<span className="truncate">{entry.name}</span>
				{entry.isProject && <span className="ml-auto shrink-0 text-xs text-muted">{t.frontendProject}</span>}
			</div>
			{expanded && children && (
				<ul role="group">
					{children.length === 0 && (
						<li className="h-7 text-xs leading-7 text-faint" style={{ paddingLeft: 30 + (depth + 1) * 16 }}>
							{t.noSubfolders}
						</li>
					)}
					{children.map((child) => (
						<FolderNode key={child.path} {...{ t, entry: child, depth: depth + 1, selected, listFolder, onSelect, onConfirm, onError }} />
					))}
				</ul>
			)}
		</li>
	);
}

type PickerProps = {
	t: T;
	title: string;
	confirmLabel: string;
	initialPath: string;
	places: Place[];
	listFolder: ListFolder;
	onConfirm: (path: string) => Promise<void> | void;
	onClose: () => void;
};

/** 应用内文件夹选择对话框：后台按需列目录，可键入或粘贴路径跳转。 */
export function FolderPicker({ t, title, confirmLabel, initialPath, places, listFolder, onConfirm, onClose }: PickerProps) {
	const [listing, setListing] = useState<FolderListing>();
	const [pathInput, setPathInput] = useState(initialPath);
	const [selected, setSelected] = useState<string>();
	const [error, setError] = useState("");

	// 只认用户最后一次的意图：先发出的慢请求晚回来时，不能把用户带回旧位置或覆盖正在输入的路径。
	const latestGo = useRef(0);
	const go = async (path: string) => {
		const attempt = ++latestGo.current;
		try {
			const next = await listFolder(path);
			if (attempt !== latestGo.current) return;
			setListing(next);
			setPathInput(next.path);
			setSelected(next.path);
			setError("");
		} catch (e) {
			if (attempt === latestGo.current) setError(errorText(t, e as RequestError));
		}
	};
	// initialPath 只决定打开时的位置；之后用户浏览到哪里就停在哪里，不随父组件重渲染重置。
	useEffect(() => {
		go(initialPath);
	}, []);

	const confirm = async (path: string) => {
		try {
			await onConfirm(path);
		} catch (e) {
			setError(errorText(t, e as RequestError));
		}
	};

	return (
		<Modal title={title} onClose={onClose} className="h-[min(560px,90vh)] w-[min(720px,94vw)]">
			<form
				className="flex items-center gap-1 px-4 pb-2"
				onSubmit={(e) => {
					e.preventDefault();
					go(pathInput);
				}}
			>
				<IconButton label={t.up} disabled={!listing?.parent} onClick={() => listing?.parent && go(listing.parent)}>
					<ArrowUp size={16} />
				</IconButton>
				<input
					aria-label={t.pathLabel}
					value={pathInput}
					onChange={(e) => {
						latestGo.current++;
						setPathInput(e.target.value);
					}}
					spellCheck={false}
					className="h-7 min-w-0 flex-1 rounded-md bg-panel px-2 font-mono text-[12.5px] ring-1 ring-line ring-inset focus:ring-accent focus:outline-none"
				/>
			</form>
			{error && (
				<p role="alert" className="px-4 pb-2 text-[12.5px] text-danger">
					{error}
				</p>
			)}
			<div className="flex min-h-0 flex-1 border-y border-line">
				<nav className="w-36 shrink-0 space-y-0.5 border-r border-line bg-app p-1.5">
					{places.map((place) => {
						const Icon = PLACE_ICONS[place.key];
						return (
							<button
								key={place.path}
								type="button"
								onClick={() => go(place.path)}
								aria-current={listing?.path === place.path || undefined}
								className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left ${listing?.path === place.path ? "bg-selected" : "hover:bg-hover"}`}
							>
								<Icon size={16} className="text-muted" />
								{place.key === "drive" ? place.path : t.places[place.key]}
							</button>
						);
					})}
				</nav>
				<ul role="tree" aria-label={listing?.path} className="min-w-0 flex-1 overflow-y-auto bg-panel p-1.5">
					{listing?.entries.length === 0 && <li className="p-2 text-faint">{t.noSubfolders}</li>}
					{listing?.entries.map((entry) => (
						<FolderNode
							key={entry.path}
							{...{ t, entry, depth: 0, selected, listFolder, onConfirm: confirm }}
							onError={(e) => setError(errorText(t, e))}
							onSelect={(path) => {
								setSelected(path);
								setError("");
							}}
						/>
					))}
				</ul>
			</div>
			<div className="flex items-center gap-2 px-4 py-3">
				<span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={selected}>
					{selected}
				</span>
				<Button onClick={onClose}>{t.cancel}</Button>
				<Button variant="primary" disabled={!selected} onClick={() => selected && confirm(selected)}>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
}
