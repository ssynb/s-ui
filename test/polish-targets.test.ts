import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { inspectPage } from "../server/page-inspect.ts";
import { componentLayer } from "../web/src/polish/components.ts";
import { componentRequest, motionRequest } from "../web/src/polish/prompt.ts";
import { MOTION_EFFECTS, motionLayer } from "../web/src/polish/motion.ts";

async function fixture(t: import("node:test").TestContext) {
 const browser = await chromium.launch({ headless: true });
 t.after(() => browser.close());
 const page = await browser.newPage();
 await page.route("http://targets.test/**", route => route.fulfill({ contentType: "text/html", body: '<button class="same">Save</button><button class="same">Save</button><input aria-label="Email"><a href="#next">Next</a>' }));
 await page.goto("http://targets.test/one");
 return page;
}

async function finishButtonTransitions(page: import("playwright").Page) {
 await page.locator("button").evaluateAll(async buttons => {
  // getAnimations flushes pending style changes; finished resolves on the real transition end.
  await Promise.all(buttons.flatMap(button => button.getAnimations()).map(animation => animation.finished));
 });
}

test("inspection exposes distinguishable, non-overlapping instances; a trial and application default to one, with explicit group scope", async t => {
 const page = await fixture(t);
 const inspection = await page.evaluate(inspectPage);
 const buttons = inspection.components.find(c => c.kind === "button")!;
 assert.equal(buttons.instances?.length, 2);
 assert.notEqual(buttons.instances![0]!.name, buttons.instances![1]!.name);
 const { selectTarget } = await import("../web/src/polish/targets.ts");
 const one = selectTarget(buttons, buttons.instances![1]!, false);
 const all = selectTarget(buttons, buttons.instances![1]!, true);
 assert.equal(await page.locator(one.groupSelector).count(), 1);
 assert.equal(await page.locator(all.groupSelector).count(), 2);
 assert.equal(await page.locator(buttons.instances![0]!.selector).and(page.locator(buttons.instances![1]!.selector)).count(), 0);
 const style = await page.addStyleTag({ content: componentLayer(one, "soft") });
 await finishButtonTransitions(page);
 assert.notEqual(await page.locator("button").nth(0).evaluate(e => getComputedStyle(e).backgroundColor), await page.locator("button").nth(1).evaluate(e => getComputedStyle(e).backgroundColor));
 await style.evaluate((e, css) => e.textContent = css, componentLayer(all, "soft"));
 await finishButtonTransitions(page);
 assert.equal(await page.locator("button").nth(0).evaluate(e => getComputedStyle(e).backgroundColor), await page.locator("button").nth(1).evaluate(e => getComputedStyle(e).backgroundColor));
 const request = componentRequest({ found: one, variant: "soft", reasons: {}, locale: "en" });
 assert.ok(request.includes(one.selector));
 assert.ok(!request.includes(buttons.instances![0]!.selector));
 assert.match(request, /only|Only/);
 await page.evaluate(() => history.pushState({}, "", "/two"));
 assert.equal(await page.locator(one.groupSelector).count(), 0, "old route selectors must stop matching immediately");
});

test("state and trigger effects run on the selected real element and stop motion under reduced-motion", async t => {
 const page = await fixture(t);
 const inspection = await page.evaluate(inspectPage);
 const buttons = inspection.components.find(c => c.kind === "button")!;
 assert.ok(buttons.instances?.length);
 const { selectTarget } = await import("../web/src/polish/targets.ts");
 const one = selectTarget(buttons, buttons.instances![0]!, false);
 const effect = MOTION_EFFECTS.find(e => e.id === "hover-grow");
 assert.ok(effect, "direct hover-grow candidate exists");
 await page.addStyleTag({ content: motionLayer(effect, one, { duration: 0 }) });
 await page.locator("button").first().hover();
 assert.notEqual(await page.locator("button").first().evaluate(e => getComputedStyle(e).transform), "none");
 assert.equal(await page.locator("button").nth(1).evaluate(e => getComputedStyle(e).transform), "none");
 const loading = MOTION_EFFECTS.find(e => e.id === "loading")!;
 await page.addStyleTag({ content: motionLayer(loading, one, {}) });
 assert.notEqual(await page.locator("button").first().evaluate(e => getComputedStyle(e, "::after").animationName), "none");
 assert.equal(await page.locator("button").nth(1).evaluate(e => getComputedStyle(e, "::after").animationName), "none");
 await page.emulateMedia({ reducedMotion: "reduce" });
 assert.equal(await page.locator("button").first().evaluate(e => getComputedStyle(e, "::after").animationName), "none");
 assert.equal(await page.locator("button").first().evaluate(e => getComputedStyle(e).transform), "none");
 const request = motionRequest({ found: one, effect, params: {}, locale: "en" });
 assert.ok(request.includes(one.selector));
 assert.match(request, /only|Only/);
});
