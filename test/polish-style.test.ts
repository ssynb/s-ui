import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFakeLlm } from "./fake-llm.ts";
import { styleModule } from "../server/modules/style.ts";
import { styleLayer } from "../server/modules/style-plan.ts";
import { StyleTrial } from "../web/src/polish/style/trial.ts";
import type { PageInspection, PreviewControl } from "../web/src/panels.ts";

const page: PageInspection = { url: "http://localhost:1234/", components: [{ kind: "heading", count: 1, selector: "h1", groupSelector: "h1", text: "Hello", styles: { fontSize: "24px" } }], fonts: [], colors: [] };
const plan = { summary: "Editorial hierarchy", changes: [{ target: 0, properties: { "font-size": "40px", "margin-bottom": "24px", "color": "#112233" } }] };
const reference = { name: "Reference", url: "https://example.com/", image: "aGVsbG8=" };

test("isolated style request uses the reference image and bounded inspection, produces safe style without changing files", async (t) => {
 const dir = await mkdtemp(join(tmpdir(), "style-"));
 t.after(() => rm(dir, { recursive: true, force: true }));
 await writeFile(join(dir, "page.html"), "original");
 let answer: unknown = plan;
 const llm = await startFakeLlm(dir, {}, () => ({ text: JSON.stringify(answer) }));
 t.after(llm.close);
 const ctx = { modelRuntime: llm.modelRuntime, project: { dir, model: llm.modelRuntime.getModel("fake", "fake-1")!, exclusive: async () => { throw new Error("Must not write"); } }, progress() {} };
 const result = await styleModule("propose", { page, reference, locale: "en" }, ctx);
 assert.deepEqual(result, plan);
 assert.equal(await readFile(join(dir, "page.html"), "utf8"), "original");
 assert.match(JSON.stringify(llm.requests[0]), /image_url/);
 assert.match(JSON.stringify(llm.requests[0]), /Hello/);
 assert.ok(!(llm.requests[0] as unknown as { tools?: unknown[] }).tools?.length);
 for (const invalid of [
  { ...plan, changes: [{ target: 0, selector: "body", properties: { color: "#112233" } }] },
  { ...plan, changes: [{ target: 0, properties: { background: "url(https://evil.test)" } }] },
  { ...plan, changes: [{ target: 0, properties: { color: "red;}body{display:none" } }] },
  { ...plan, changes: [{ target: 99, properties: { color: "#112233" } }] },
  { ...plan, changes: [] },
 ]) {
  answer = invalid;
  await assert.rejects(styleModule("propose", { page, reference, locale: "en" }, ctx), /style|plan|target|property|value/i);
 }
 assert.equal(styleLayer(plan, page), ":is(h1){font-size:40px!important;margin-bottom:24px!important;color:#112233!important}");
 assert.throws(() => styleLayer(plan, { ...page, components: [{ ...page.components[0]!, groupSelector: "h1){}body{" }] }), /selector/i);
});

function fixture() {
 let current = page;
 let css = "";
 let submitted = 0;
 const preview: PreviewControl = { ready: true, inspect: async () => current, applyLayer: async (_id, value) => { css = value; }, clearLayer: async () => { css = ""; }, clearAll: async () => {}, loadFonts: async () => {}, readTokens: async () => ({}) };
 const trial = new StyleTrial(preview, () => { submitted++; });
 return { trial, preview, navigate: () => { current = { ...page, url: "http://localhost:1234/other" }; }, get css() { return css; }, get submitted() { return submitted; } };
}

test("style is tried on the actual preview; only explicit confirmation submits concrete changes and reference", async () => {
 const f = fixture();
 await assert.rejects(f.trial.confirm(), /preview|trial/i);
 await f.trial.try(reference, async () => plan);
 assert.match(f.css, /font-size:40px/);
 assert.equal(f.submitted, 0);
 const submission = await f.trial.confirm();
 assert.match(submission.text, /40px/);
 assert.match(submission.text, /https:\/\/example.com/);
 assert.equal(submission.images?.[0]?.data, reference.image);
 assert.equal(f.submitted, 1);
 assert.equal(f.css, "");
});

test("cancel restores the page and invalidates in-flight proposals; failures never enable confirmation", async () => {
 const f = fixture();
 let resolve!: (value: typeof plan) => void;
 const generating = f.trial.try(reference, () => new Promise((r) => { resolve = r; }));
 // The proposal starts after inspecting the page.
 await Promise.resolve();
 await f.trial.cancel();
 resolve(plan);
 await generating;
 assert.equal(f.css, "");
 await assert.rejects(f.trial.confirm(), /preview|trial/i);
 f.preview.applyLayer = async () => { throw new Error("Preview disconnected"); };
 await assert.rejects(f.trial.try(reference, async () => plan), /Preview disconnected/);
 await assert.rejects(f.trial.confirm(), /preview|trial/i);
 assert.equal(f.submitted, 0);
});

test("page changes invalidate the trial before application or confirmation", async () => {
 const f = fixture();
 await f.trial.try(reference, async () => { f.navigate(); return plan; });
 assert.equal(f.css, "");
 await assert.rejects(f.trial.confirm(), /preview|trial/i);
 const g = fixture();
 await g.trial.try(reference, async () => plan);
 g.navigate();
 await assert.rejects(g.trial.confirm(), /page/i);
 assert.equal(g.css, "");
 assert.equal(g.submitted, 0);
});
