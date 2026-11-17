import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { inspectPage } from "../server/page-inspect.ts";

// AI 写的页面常见写法：卡片共用一个基础 class、再各带一个变体 class；标题是 h1/h2/h3 混排。
const PAGE = `<!doctype html><html><head><style>
.work-card { display: inline-block; width: 220px; height: 160px; margin: 8px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.12); background: #fff; }
.work-card.sage { background: #dfe7d8; } .work-card.sky { background: #d8e3e7; } .work-card.sand { background: #efdcc4; }
</style></head><body>
<h1>Portfolio</h1><h2>Recent work</h2>
<article class="work-card sage"><h3>One</h3></article><article class="work-card sky"><h3>Two</h3></article><article class="work-card sand"><h3>Three</h3></article>
</body></html>`;

test("cards that share a base class but differ by a modifier are one kind, and mixed headings get a selector covering all of them", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	await page.setContent(PAGE);
	const result = await page.evaluate(inspectPage);
	const byKind = Object.fromEntries(result.components.map((c) => [c.kind, c]));

	assert.equal(byKind.card?.count, 3);
	assert.equal(await page.locator(byKind.card!.groupSelector).count(), 3);
	assert.equal(byKind.heading?.count, 5);
	assert.equal(await page.locator(byKind.heading!.groupSelector).count(), 5);
	assert.equal(byKind.heading!.groupSelector.split(",").length <= 3, true, byKind.heading!.groupSelector);
});
