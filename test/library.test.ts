import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, type PromptEntry } from "../web/src/library/prompt.ts";

const button: PromptEntry = {
	name: { zh: "按钮", en: "Button" },
	variants: [
		{ id: "solid", name: { zh: "实底", en: "Solid" } },
		{ id: "outline", name: { zh: "描边", en: "Outline" } },
		{ id: "ghost", name: { zh: "幽灵", en: "Ghost" } },
	],
	params: [
		{ key: "radius", label: { zh: "圆角", en: "Corner radius" }, kind: "range", min: 0, max: 16, step: 1, unit: "px", default: 8 },
		{
			key: "easing",
			label: { zh: "缓动", en: "Easing" },
			kind: "select",
			showValue: true,
			default: "linear",
			options: [
				{ value: "linear", label: { zh: "匀速", en: "Linear" } },
				{ value: "cubic-bezier(.2,.8,.2,1)", label: { zh: "先快后慢", en: "Ease out" } },
			],
		},
		{ key: "color", label: { zh: "颜色", en: "Color" }, kind: "color", default: "#3574f0" },
	],
	describe: (p) => ({ zh: `按下时缩到 ${p.radius} 号圆角`, en: `press to radius ${p.radius}` }),
	states: { zh: "默认、悬停、禁用", en: "default, hover, disabled" },
};

const tuned = {
	variant: "outline",
	params: { radius: 13, easing: "cubic-bezier(.2,.8,.2,1)", color: "#e0457b" },
	reasons: { ghost: "太弱，看不出能点" },
};

test("the request handed to the AI names the chosen variant, the tuned values and why other variants were rejected", () => {
	const zh = buildPrompt(button, tuned, { kind: "page" }, "zh");
	assert.match(zh, /描边/);
	assert.match(zh, /13px/);
	assert.match(zh, /先快后慢.*cubic-bezier\(\.2,\.8,\.2,1\)/);
	assert.match(zh, /#e0457b/);
	assert.match(zh, /默认、悬停、禁用/);
	assert.match(zh, /幽灵.*太弱，看不出能点/);
	assert.doesNotMatch(zh, /8px/);

	const en = buildPrompt(button, tuned, { kind: "page" }, "en");
	assert.match(en, /Outline/);
	assert.match(en, /Corner radius.*13px/);
	assert.match(en, /Ghost.*太弱，看不出能点/);
	assert.doesNotMatch(en, /[按钮描边圆角]/);
});

test("the request says whether it applies to the circled elements or to the whole page", () => {
	const circled = buildPrompt(button, tuned, { kind: "selection", count: 2 }, "en");
	const page = buildPrompt(button, tuned, { kind: "page" }, "en");
	assert.match(circled, /2 circled elements/);
	assert.doesNotMatch(page, /circled/);
	assert.match(page, /whole page/);
});
