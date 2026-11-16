import { LoaderCircle } from "lucide-react";
import { type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

// 共享控件。密度统一为 compact：控件高 28px、文字 13px、图标 16px。

type ButtonVariant = "primary" | "default" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-accent text-white hover:bg-accent-hover",
	default: "bg-panel text-fg ring-1 ring-line ring-inset hover:bg-hover",
	ghost: "text-fg hover:bg-hover",
};

export function Button({ variant = "default", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
	return (
		<button
			type="button"
			{...props}
			className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] whitespace-nowrap disabled:opacity-40 ${BUTTON_VARIANTS[variant]} ${className}`}
		/>
	);
}

export function IconButton({ label, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			{...props}
			className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-40 ${className}`}
		/>
	);
}

export function Spinner({ className = "" }: { className?: string }) {
	return <LoaderCircle aria-hidden size={14} className={`animate-spin ${className}`} />;
}

const ICON_COLORS = ["#3574f0", "#5fb865", "#e08855", "#a571e6", "#d8577a", "#2aa5a0", "#c9a12c", "#6f86ad"];

/** IDEA 风格的项目图标：取名字首字，颜色由名字决定，同一项目每次一样。 */
export function ProjectIcon({ name, size = 20 }: { name: string; size?: number }) {
	const hash = [...name].reduce((h, c) => (h * 31 + c.codePointAt(0)!) >>> 0, 0);
	const letters = /^[a-z0-9]/i.test(name) ? name.replace(/[^a-z0-9]/gi, "").slice(0, 2) : [...name][0];
	return (
		<span
			aria-hidden
			className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold text-white uppercase"
			style={{ width: size, height: size, fontSize: size * 0.45, background: ICON_COLORS[hash % ICON_COLORS.length] }}
		>
			{letters}
		</span>
	);
}

function focusSibling(e: KeyboardEvent<HTMLDivElement>) {
	const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)")];
	const index = items.indexOf(document.activeElement as HTMLElement);
	const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
	if (!step) return;
	e.preventDefault();
	items[(index + step + items.length) % items.length]?.focus();
}

/** 下拉菜单：点击按钮展开，点外面、按 Esc 或选中一项后收起。 */
export function Menu({
	button,
	buttonLabel,
	disabled,
	title,
	align = "left",
	children,
}: {
	button: ReactNode;
	buttonLabel?: string;
	disabled?: boolean;
	title?: string;
	align?: "left" | "right";
	children: (close: () => void) => ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const menu = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
		const onPointer = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", onPointer);
		return () => document.removeEventListener("pointerdown", onPointer);
	}, [open]);

	return (
		<div ref={root} className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={buttonLabel}
				title={title}
				disabled={disabled}
				onClick={() => setOpen((o) => !o)}
				className={`inline-flex h-7 max-w-80 items-center gap-1.5 rounded-md px-2 text-[13px] hover:bg-hover disabled:hover:bg-transparent ${open ? "bg-hover" : ""}`}
			>
				{button}
			</button>
			{open && (
				<div
					ref={menu}
					role="menu"
					onKeyDown={(e) => {
						if (e.key === "Escape") setOpen(false);
						focusSibling(e);
					}}
					className={`absolute top-full z-30 mt-1 max-h-[70vh] min-w-56 overflow-y-auto rounded-lg bg-raised p-1 shadow-lg ring-1 ring-line ${align === "right" ? "right-0" : "left-0"}`}
				>
					{children(() => setOpen(false))}
				</div>
			)}
		</div>
	);
}

export function MenuItem({ onSelect, children, selected }: { onSelect: () => void; children: ReactNode; selected?: boolean }) {
	return (
		<button
			type="button"
			role="menuitem"
			aria-current={selected || undefined}
			onClick={onSelect}
			className={`flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-hover focus-visible:bg-hover focus-visible:outline-none ${selected ? "text-accent" : ""}`}
		>
			{children}
		</button>
	);
}

export function MenuLabel({ children }: { children: ReactNode }) {
	return <div className="px-2 pt-1.5 pb-1 text-xs text-muted">{children}</div>;
}

export function MenuSeparator() {
	return <div role="separator" className="my-1 h-px bg-line" />;
}

/** 原生 <dialog> 模态框：自带焦点约束和 Esc 关闭。 */
export function Modal({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		ref.current?.showModal();
	}, []);
	return (
		<dialog
			ref={ref}
			aria-label={title}
			onClose={onClose}
			className={`m-auto flex flex-col overflow-hidden rounded-xl bg-raised p-0 text-fg shadow-2xl ring-1 ring-line ${className}`}
		>
			<h2 className="px-4 pt-3.5 pb-2 text-sm font-semibold">{title}</h2>
			{children}
		</dialog>
	);
}
