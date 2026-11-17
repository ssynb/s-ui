import { Blocks } from "lucide-react";
import type { PanelDefinition } from "../panels.ts";
import { LibraryPanel } from "./LibraryPanel.tsx";
import { STRINGS } from "./strings.ts";

export const libraryPanel: PanelDefinition = {
	id: "library",
	icon: Blocks,
	title: (locale) => STRINGS[locale].title,
	Component: LibraryPanel,
};
