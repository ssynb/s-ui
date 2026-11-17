import { test } from "node:test";
import assert from "node:assert/strict";
import type { FoundComponent } from "../web/src/panels.ts";
import { MOTION_EFFECTS, motionLayer } from "../web/src/polish/motion.ts";
import { afterSave, EMPTY_DRAFT, type PolishDraft } from "../web/src/polish/state.ts";

test("changes made while a save is in flight stay unsaved; only what was sent is cleared", () => {
	const sent: PolishDraft = { ...EMPTY_DRAFT, palette: "rose", shape: { radius: 16, shadow: 2 } };
	const now: PolishDraft = { ...sent, palette: "forest", shape: { radius: 16, shadow: 3 }, font: "inter" };
	const left = afterSave(now, sent);
	assert.equal(left.palette, "forest");
	assert.equal(left.font, "inter");
	assert.deepEqual(left.shape, { shadow: 3 });
});

const found = (kind: FoundComponent["kind"], groupSelector: string): FoundComponent => ({ kind, count: 2, selector: groupSelector, groupSelector, text: "", styles: {} });
const keyframeNames = (css: string) => [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);

test("the same effect tried on two component groups keeps each group's own parameters", () => {
	for (const effect of MOTION_EFFECTS) {
		const [a, b] = effect.kinds;
		if (!b) continue;
		const first = keyframeNames(motionLayer(effect, found(a!, ".a"), {}, 1));
		const second = new Set(keyframeNames(motionLayer(effect, found(b, ".b"), {}, 1)));
		assert.ok(first.every((name) => !second.has(name)), `${effect.id}: ${a} and ${b} share ${first.join(",")}`);
	}
});
