import { test } from "node:test";
import assert from "node:assert/strict";
import type { FoundComponent, PolishStatus } from "../web/src/panels.ts";
import { contrastRatio, readableOn } from "../web/src/polish/color.ts";
import { COMPONENT_VARIANTS, componentLayer } from "../web/src/polish/components.ts";
import { MOTION_EFFECTS, motionLayer } from "../web/src/polish/motion.ts";
import { componentRequest } from "../web/src/polish/prompt.ts";
import { savePayload } from "../web/src/polish/draft.ts";

const status: PolishStatus = {
	organized: true,
	file: "src/design-tokens.css",
	values: { "--sui-color-primary": "#3574f0", "--sui-color-bg": "#ffffff", "--sui-radius-md": "8px", "--sui-font-sans": "system-ui, sans-serif" },
	missing: [],
	fontImports: ["https://fonts.googleapis.com/css2?family=Inter&display=swap"],
};

test("saving sends only the design variables that differ from the file, and font imports only when fonts changed", () => {
	const tokens = { "--sui-color-primary": "#e0457b", "--sui-color-bg": "#ffffff", "--sui-radius-md": "8px" } as const;
	assert.deepEqual(savePayload({ tokens }, status), { values: { "--sui-color-primary": "#e0457b" } });

	const fontImports = ["https://fonts.googleapis.com/css2?family=Lora&display=swap"];
	const withFont = savePayload({ tokens: { "--sui-font-sans": "'Lora', serif" }, fontImports }, status);
	assert.deepEqual(withFont, { values: { "--sui-font-sans": "'Lora', serif" }, fontImports });

	const sameFont = savePayload({ tokens: {}, fontImports: [...status.fontImports] }, status);
	assert.deepEqual(sameFont, { values: {} });
});

test("text on the primary color stays readable (WCAG AA 4.5:1) for any primary", () => {
	assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
	assert.equal(readableOn("#1e3a8a"), "#ffffff");
	assert.equal(readableOn("#ffd400"), "#000000");
	for (let hue = 0; hue < 360; hue += 15)
		for (const light of [25, 45, 55, 65, 85]) {
			const primary = hslHex(hue, 80, light);
			assert.ok(contrastRatio(primary, readableOn(primary)) >= 4.5, `${primary} → ${readableOn(primary)}`);
		}
});

const found = (kind: FoundComponent["kind"], groupSelector: string): FoundComponent => ({
	kind,
	count: 3,
	selector: `main > ${groupSelector.split(",")[0]}:nth-of-type(1)`,
	groupSelector,
	text: "Get started",
	styles: { backgroundColor: "rgb(28, 25, 23)", color: "rgb(255, 255, 255)", borderRadius: "8px", padding: "12px 20px" },
});

/** CSS 里每条规则的选择器（跳过 @ 规则与关键帧的 from/to/百分比）。 */
function selectors(css: string) {
	return [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{};]+)\{/g)]
		.map((m) => m[1]!.trim())
		.filter((s) => !s.startsWith("@") && !/^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(s));
}

test("trying a component variant or a motion effect only restyles that component group on the page", () => {
	const group = ".btn, a.cta";
	for (const [kind, variants] of Object.entries(COMPONENT_VARIANTS)) {
		const target = found(kind as FoundComponent["kind"], group);
		for (const variant of variants) {
			const css = componentLayer(target, variant.id);
			assert.ok(css.length > 0, `${kind}/${variant.id} produces CSS`);
			for (const sel of selectors(css)) assert.ok(sel.startsWith(`:is(${group})`), `${kind}/${variant.id}: ${sel}`);
		}
	}
	for (const effect of MOTION_EFFECTS)
		for (const kind of effect.kinds) {
			const css = motionLayer(effect, found(kind, group), {});
			for (const sel of selectors(css)) assert.ok(sel.startsWith(`:is(${group})`), `${effect.id}/${kind}: ${sel}`);
		}
});

test("the request handed to the AI names the chosen variant, where it is on the page, its current styles and rejected variants", () => {
	const button = found("button", ".btn");
	const [chosen, rejected] = COMPONENT_VARIANTS.button!;
	const text = componentRequest({ found: button, variant: chosen!.id, reasons: { [rejected!.id]: "太抢眼" }, locale: "zh" });
	assert.match(text, new RegExp(chosen!.name.zh));
	assert.match(text, /\.btn/);
	assert.match(text, /main > \.btn:nth-of-type\(1\)/);
	assert.match(text, /8px/);
	assert.match(text, /rgb\(28, 25, 23\)/);
	assert.match(text, new RegExp(`${rejected!.name.zh}.*太抢眼`));

	const en = componentRequest({ found: button, variant: chosen!.id, reasons: {}, locale: "en" });
	assert.match(en, new RegExp(chosen!.name.en));
	assert.doesNotMatch(en, /[\u4e00-\u9fff]/);
});

function hslHex(h: number, s: number, l: number) {
	const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(c * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}
