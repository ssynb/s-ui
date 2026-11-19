import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright";
import { startPreviewProxy } from "../server/preview-proxy.ts";
import { PREVIEW_OP_MESSAGE } from "../server/protocol.ts";
import { servePage } from "./page-fixture.ts";

// Real bridge and browser navigation, without a mounted panel to perform cleanup.
test("page-scoped style trials clear on SPA navigation, pagehide and reload; stale requests cannot restore them", async (t) => {
 const browser = await chromium.launch();
 t.after(() => browser.close());
 const site = await servePage();
 t.after(site.close);
 let previewUrl = "";
 const host = createServer((_req, res) => res.end(`<iframe src="${previewUrl}"></iframe><script>
 const pending=new Map();let next=0;window.events=[];
 addEventListener('message',e=>{if(e.data?.type!==${JSON.stringify(PREVIEW_OP_MESSAGE)})return;if(e.data.event){window.events.push(e.data.event);return;}pending.get(e.data.id)(e.data);pending.delete(e.data.id)});
 window.op=op=>new Promise(resolve=>{const id=++next;pending.set(id,resolve);document.querySelector('iframe').contentWindow.postMessage({type:${JSON.stringify(PREVIEW_OP_MESSAGE)},id,op},new URL(document.querySelector('iframe').src).origin)});
 </script>`));
 await new Promise<void>(r => host.listen(0, "127.0.0.1", r));
 t.after(() => host.close());
 const origin = `http://127.0.0.1:${(host.address() as AddressInfo).port}`;
 const proxy = await startPreviewProxy(site.url, [origin]);
 t.after(() => proxy.close());
 previewUrl = proxy.url;
 const page = await browser.newPage();
 await page.goto(origin);
 await page.waitForFunction(() => (window as any).events.includes("ready"));
 const frame = page.frames().find(f => f.url().startsWith(previewUrl))!;
 const op = (value: object) => page.evaluate(value => (window as any).op(value), value);
 const apply = async () => {
  const inspection = await op({ name: "inspect" });
  assert.equal(typeof inspection.result.stylePageId, "string", "inspection carries the live page identity");
  const id = `polish-style:${inspection.result.stylePageId}`;
  assert.equal((await op({ name: "applyLayer", id, css: "h1{font-size:40px!important}" })).ok, true);
  assert.equal(await frame.locator(`style[data-sui-layer="${id}"]`).count(), 1);
  assert.ok(!await frame.evaluate(() => sessionStorage.getItem("s-ui:preview-layers")!.includes("polish-style")), "trial never enters persisted layers");
  return id;
 };
 await op({ name: "applyLayer", id: "colors", css: ":root{--sui-color-primary:#112233}" });
 for (const navigate of [
  () => frame.evaluate(() => history.pushState({}, "", "/a")),
  () => frame.evaluate(() => history.replaceState({}, "", "/b")),
  () => frame.evaluate(() => { location.hash = "section"; }),
  async () => { await frame.evaluate(() => history.back()); await frame.waitForURL(url => !url.hash); },
 ]) {
  const id = await apply();
  await navigate();
  await frame.locator(`style[data-sui-layer="${id}"]`).waitFor({ state: "detached" });
  assert.equal((await op({ name: "applyLayer", id, css: "h1{font-size:40px!important}" })).ok, false, "late model reply cannot apply to another page");
  assert.equal(await frame.locator('style[data-sui-layer="colors"]').count(), 1, "other polish layers stay intact");
 }
 const old = await apply();
 await frame.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
 assert.equal(await frame.locator(`style[data-sui-layer="${old}"]`).count(), 0, "pagehide clears even without a parent response");
 await frame.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
 assert.equal((await op({ name: "applyLayer", id: old, css: "h1{}" })).ok, false);
 await apply();
 await frame.goto(previewUrl);
 assert.equal(await frame.locator('style[data-sui-layer^="polish-style"]').count(), 0);
 assert.equal(await frame.locator('style[data-sui-layer="colors"]').count(), 1);
 // A layer persisted by the preceding implementation must not be resurrected either.
 await frame.evaluate(() => sessionStorage.setItem("s-ui:preview-layers", JSON.stringify({ layers: [["polish-style", "h1{display:none}"]], fonts: [] })));
 await frame.goto(previewUrl);
 assert.equal(await frame.locator('style[data-sui-layer="polish-style"]').count(), 0);
});
