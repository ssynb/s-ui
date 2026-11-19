import type { PageInspection } from "../page-inspect.ts";

/** Closed vocabulary: model output never supplies CSS syntax, selectors or resource addresses. */
export const STYLE_PROPERTIES = {
	"color": "#RRGGBB", "background-color": "#RRGGBB", "border-color": "#RRGGBB",
	"font-size": "12–64px", "font-weight": "400 | 500 | 600 | 700 | 800",
	"line-height": "1.1 | 1.2 | 1.4 | 1.5 | 1.6", "letter-spacing": "-0.02em | 0em | 0.02em",
	"font-family": "system-ui, sans-serif | Georgia, serif | monospace",
	"padding": "0–48px", "gap": "0–48px", "margin-bottom": "0–64px",
	"border-radius": "0–32px", "border-width": "0px | 1px | 2px", "border-style": "solid",
	"max-width": "100% | 40rem | 60rem | 80rem", "text-align": "left | center",
	"box-shadow": "none | 0 2px 8px #00000014 | 0 8px 24px #0000001a",
} as const;
export type StylePlan = { summary: string; changes: { target: number; properties: Record<string, string> }[] };
export type StyleReference = { name: string; url: string; image: string };

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid style plan object");
	return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
	if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Unknown style plan property");
}
function validValue(property: string, value: string) {
	if (!Object.hasOwn(STYLE_PROPERTIES, property)) return false;
	const rule = STYLE_PROPERTIES[property as keyof typeof STYLE_PROPERTIES];
	if (rule === "#RRGGBB") return /^#[\da-f]{6}$/i.test(value);
	const range = /^(\d+)–(\d+)px$/.exec(rule);
	if (range) return /^\d+px$/.test(value) && parseInt(value) >= Number(range[1]) && parseInt(value) <= Number(range[2]);
	return rule.split(" | ").includes(value);
}

export function parseStylePlan(value: unknown, page: PageInspection): StylePlan {
	const plan = record(value);
	keys(plan, ["summary", "changes"]);
	if (typeof plan.summary !== "string" || !plan.summary.trim() || plan.summary.length > 600 || !Array.isArray(plan.changes) || !plan.changes.length || plan.changes.length > 24) throw new Error("Invalid style plan");
	const seen = new Set<number>();
	const changes = plan.changes.map((input) => {
		const change = record(input);
		keys(change, ["target", "properties"]);
		const target = change.target;
		if (typeof target !== "number" || !Number.isInteger(target) || !page.components[target] || seen.has(target)) throw new Error("Invalid style target");
		seen.add(target);
		const properties = record(change.properties);
		if (!Object.keys(properties).length) throw new Error("Empty style properties");
		for (const [property, value] of Object.entries(properties)) {
			if (typeof value !== "string" || !validValue(property, value)) throw new Error(`Invalid style property/value: ${property}`);
		}
		return { target, properties: properties as Record<string, string> };
	});
	return { summary: plan.summary, changes };
}

export function styleLayer(input: unknown, page: PageInspection): string {
	return parseStylePlan(input, page).changes.map(({ target, properties }) => {
		const component = page.components[target]!;
		const selector = component.kind === "heading" ? component.selector : component.groupSelector;
		// Escaped punctuation and exotic selectors are rejected rather than interpolated into a stylesheet.
		if ([component.selector, component.groupSelector].some((value) => !value || value.length > 4000 || !/^[\w\s.#,:>()[\]="'-]+$/.test(value))) throw new Error("Unsupported page selector");
		return `:is(${selector}){${Object.entries(properties).map(([key, value]) => `${key}:${value}!important`).join(";")}}`;
	}).join("\n");
}
