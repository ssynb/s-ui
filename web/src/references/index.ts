import { Images } from "lucide-react";
import type { PanelDefinition } from "../panels.ts";
import { ReferencesPanel } from "./ReferencesPanel.tsx";
import { STRINGS } from "./strings.ts";

export const referencesPanel: PanelDefinition = {
	id: "references",
	icon: Images,
	title: (locale) => STRINGS[locale].title,
	Component: ReferencesPanel,
};
