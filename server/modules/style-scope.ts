import type { PageInspection } from "../page-inspect.ts";

/** Reserved namespace: these layers belong to one page visit and are never persisted. */
export const STYLE_LAYER = "polish-style";
export type StyleInspection = PageInspection & { stylePageId: string };

export function styleScope(page: PageInspection): string {
	const id = (page as Partial<StyleInspection>).stylePageId;
	if (!id) throw new Error("The preview has no page identity; reload it before trying a style");
	return `${STYLE_LAYER}:${id}`;
}
