import type { PanelProps } from "../panels.ts";
import { STRINGS } from "./strings.ts";

/** 「打磨」工具窗（占位）。 */
export function PolishPanel({ locale }: PanelProps) {
	return <p className="p-3 text-muted">{STRINGS[locale].placeholder}</p>;
}
