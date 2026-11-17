import { test } from "node:test";
import assert from "node:assert/strict";
import type { FoundComponent, PageInspection } from "../web/src/panels.ts";
import { leftoverPrimary } from "../web/src/polish/color.ts";

const component = (kind: FoundComponent["kind"], groupSelector: string, styles: Record<string, string>): FoundComponent => ({
	kind,
	count: 2,
	selector: `${groupSelector}:nth-of-type(1)`,
	groupSelector,
	text: "",
	styles,
});

test("after switching colors, components still painted in the old primary are reported with their selectors", () => {
	const inspection: PageInspection = {
		url: "http://localhost:5173/",
		components: [
			component("button", ".btn-primary", { backgroundColor: "rgb(225, 29, 72)", color: "rgb(255, 255, 255)" }),
			component("link", ".learn-more", { color: "rgb(37, 99, 235)", backgroundColor: "rgba(0, 0, 0, 0)" }),
			component("card", ".card", { backgroundColor: "rgb(255, 255, 255)", border: "1px solid rgb(37, 99, 235)" }),
		],
		fonts: [],
		colors: ["rgb(255, 255, 255)", "rgb(37, 99, 235)", "rgb(225, 29, 72)"],
	};
	const left = leftoverPrimary(inspection, "#2563eb");
	assert.deepEqual(
		left.map((c) => c.groupSelector),
		[".learn-more", ".card"],
	);
	assert.deepEqual(leftoverPrimary(inspection, "#7c3aed"), []);
});
