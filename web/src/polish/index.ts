import { Palette } from "lucide-react";
import type { PanelDefinition } from "../panels.ts";
import { PolishPanel } from "./PolishPanel.tsx";
import { STRINGS } from "./strings.ts";

export const polishPanel: PanelDefinition = {
	id: "polish",
	icon: Palette,
	title: (locale) => STRINGS[locale].title,
	Component: PolishPanel,
};
