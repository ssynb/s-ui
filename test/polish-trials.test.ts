import { test } from "node:test";
import assert from "node:assert/strict";
import type { FoundComponent } from "../web/src/panels.ts";
import { MOTION_EFFECTS, motionLayer } from "../web/src/polish/motion.ts";
import { afterSave, EMPTY_DRAFT, type PolishDraft } from "../web/src/polish/state.ts";

test("changes made while a save is in flight stay unsaved; only what was sent is cleared", () => {
	const sent: PolishDraft = { ...EMPTY_DRAFT, fonts: { heading: "literary", body: "geometric" } };
 const now: PolishDraft = { ...sent, fonts: { heading: "literary", body: "brush", ui: "system" } };
 const left = afterSave(now, sent);
 assert.deepEqual(left.fonts, { body: "brush", ui: "system" });
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
