import type { ButtonHTMLAttributes, ReactNode } from "react";

// 打磨面板里各分区共用的小部件。

export function Section({ id, title, note, action, disabled, children }: { id: string; title: string; note?: string; action?: ReactNode; disabled?: boolean; children: ReactNode }) {
	return (
		<section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-12 space-y-2">
			<div className="flex min-h-6 items-center gap-2">
				<h3 id={`${id}-title`} className="font-semibold">
					{title}
				</h3>
				{note && <span className="truncate text-xs text-muted">{note}</span>}
				<span className="flex-1" />
				{action}
			</div>
			{/* fieldset 让不可用时里面的控件一起禁用 */}
			<fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0 disabled:opacity-50">
				{children}
			</fieldset>
		</section>
	);
}

/** 可选中的方块（字体、配色、做法）。 */
export function Tile({ selected, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			{...props}
			className={`min-w-0 rounded-md bg-panel text-left ring-inset hover:bg-hover disabled:hover:bg-panel ${selected ? "ring-2 ring-accent" : "ring-1 ring-line"} ${className}`}
		/>
	);
}

export function Notice({ tone = "muted", children, action }: { tone?: "muted" | "danger"; children: ReactNode; action?: ReactNode }) {
	return (
		<div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-panel text-muted ring-1 ring-line"}`}>
			<p className="flex-1 text-pretty">{children}</p>
			{action}
		</div>
	);
}

export function TextButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
	return <button type="button" {...props} className={`shrink-0 text-xs text-accent hover:underline disabled:text-faint disabled:no-underline ${props.className ?? ""}`} />;
}
