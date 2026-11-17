import type { PanelProps } from "../panels.ts";
import { STRINGS } from "./strings.ts";

/** 「参考页面」工具窗（占位）。后台能力写在 server/modules/references.ts，经 callModule("references", …) 调用。 */
export function ReferencesPanel({ locale }: PanelProps) {
	return <p className="p-3 text-muted">{STRINGS[locale].placeholder}</p>;
}
