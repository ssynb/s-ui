import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { type Browser, chromium } from "playwright";
import { inspectPage } from "../server/page-inspect.ts";
import { servePage } from "./page-fixture.ts";

let browser: Browser;
let page: Awaited<ReturnType<typeof servePage>>;
before(async () => {
	browser = await chromium.launch();
	page = await servePage();
});
after(async () => {
	await browser.close();
	page.close();
});

test("inspection lists the components the page really has, with selectors that reach every instance", async () => {
	const tab = await browser.newPage();
	await tab.goto(page.url);
	const result = await tab.evaluate(inspectPage);

	const byKind = Object.fromEntries(result.components.map((c) => [c.kind, c]));
	assert.equal(byKind.button?.count, 3);
	assert.equal(byKind.card?.count, 3);
	assert.equal(byKind.input?.count, 2);
	assert.equal(byKind.nav?.count, 1);
	assert.equal(byKind.button?.text, "Start");
	assert.equal(byKind.button?.styles.backgroundColor, "rgb(53, 116, 240)");
	for (const kind of ["button", "card", "input"]) {
		const c = byKind[kind]!;
		assert.equal(await tab.locator(c.groupSelector).count(), c.count, `${kind} groupSelector ${c.groupSelector}`);
		assert.equal(await tab.locator(c.selector).count(), 1, `${kind} selector ${c.selector}`);
	}
	assert.match(result.fonts[0]!, /Georgia/);
	assert.ok(result.colors.includes("rgb(53, 116, 240)"));
	await tab.close();
});
