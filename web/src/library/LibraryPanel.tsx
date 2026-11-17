import type { PanelProps } from "../panels.ts";
import { STRINGS } from "./strings.ts";

/** 「组件库」工具窗（占位）。 */
export function LibraryPanel({ locale, selection }: PanelProps) {
	const s = STRINGS[locale];
	return (
		<div className="space-y-2 p-3 text-muted">
			<p>{s.placeholder}</p>
			{selection && <p>{s.selectionHint(selection.elements.length)}</p>}
		</div>
	);
}
