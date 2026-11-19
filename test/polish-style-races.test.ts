import { test } from "node:test";
import assert from "node:assert/strict";
import { StyleTrial } from "../web/src/polish/style/trial.ts";
import type { PreviewControl } from "../web/src/panels.ts";

function setup(clearLayer: PreviewControl["clearLayer"]) {
 let submitted = false;
 const preview: PreviewControl = {
  ready: true, clearLayer, clearAll: async () => {}, loadFonts: async () => {}, readTokens: async () => ({}), applyLayer: async () => {},
  inspect: async () => ({ stylePageId: "page", url: "http://localhost/", components: [{ kind: "heading", count: 1, selector: "h1", groupSelector: "h1", text: "Title", styles: {} }], fonts: [], colors: [] }),
 };
 const trial = new StyleTrial(preview, () => { submitted = true; });
 const start = () => trial.try({ name: "Reference", url: "https://example.com/", image: "aGVsbG8=" }, async () => ({ summary: "Title hierarchy", changes: [{ target: 0, properties: { "font-size": "40px" } }] }));
 return { trial, start, get submitted() { return submitted; } };
}

test("leaving while confirmation waits for layer removal does not submit an obsolete plan", async () => {
 const clearing = Promise.withResolvers<void>();
 const finished = Promise.withResolvers<void>();
 const f = setup(async () => { clearing.resolve(); await finished.promise; });
 await f.start();
 const confirming = f.trial.confirm();
 await clearing.promise;
 f.trial.invalidate();
 finished.resolve();
 await assert.rejects(confirming, /page|cancel/i);
 assert.equal(f.submitted, false);
});

test("a failed clear keeps the layer owned so cancelling can be retried", async () => {
 let attached = true;
 let fail = true;
 const f = setup(async () => { if (fail) throw new Error("Preview did not respond"); attached = false; });
 await f.start();
 await assert.rejects(f.trial.cancel(), /Preview did not respond/);
 fail = false;
 await f.trial.cancel();
 assert.equal(attached, false);
 assert.equal(f.submitted, false);
});
