import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { type Browser, chromium } from "playwright";
import { renderAnnotation } from "../server/annotate.ts";
import { capturePage } from "../server/page-capture.ts";
import type { Point } from "../server/protocol.ts";

// 用户浏览器里的预览页面：有弹窗、可滚动容器、可输入框，期望值都按这里的固定坐标给出。
const PAGE = `<!doctype html>
<html><body style="margin:0;height:3000px">
<h1 style="position:absolute;left:20px;top:80px;margin:0">Title far away</h1>
<button id="open" style="position:absolute;left:20px;top:20px">Open</button>
<button id="buy" style="position:absolute;left:300px;top:300px;width:120px;height:40px;border:0;background:#ff0000">Buy now</button>
<dialog id="dlg" style="inset:auto;left:300px;top:300px;margin:0;padding:0;border:0"><button id="confirm" style="display:block;width:120px;height:40px;border:0;background:#00ff00">Confirm</button></dialog>
<div id="box" style="position:absolute;left:0;top:1000px;width:800px;height:200px;overflow:auto"><div style="height:1000px"></div><button id="deep" style="display:block;margin-left:300px;width:120px;height:40px;border:0;background:#0000ff">Deep</button><div style="height:1000px"></div></div>
<script>document.getElementById("open").onclick = () => document.getElementById("dlg").showModal();</script>
</body></html>
`;
const VIEWPORT = { width: 800, height: 600 };

let dir: string;
let server: Server;
let url: string;
let browser: Browser;

before(async () => {
	dir = await mkdtemp(join(tmpdir(), "s-ui-annotate-"));
	await writeFile(join(dir, "index.html"), PAGE);
	server = createServer((_req, res) => res.end(PAGE));
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
	browser = await chromium.launch();
});
after(async () => {
	await browser.close();
	server.close();
});

function ellipse(cx: number, cy: number): Point[] {
	return Array.from({ length: 24 }, (_, i) => {
		const a = (i / 24) * 2 * Math.PI;
		return [cx + 90 * Math.cos(a), cy + 45 * Math.sin(a)];
	});
}

/** 在用户的页面上做完交互后画圈，返回交给 AI 的结果。 */
async function annotateAfter(interact: (page: import("playwright").Page) => Promise<void>, stroke: Point[]) {
	const page = await browser.newPage({ viewport: VIEWPORT });
	try {
		await page.goto(url);
		await interact(page);
		const capture = await page.evaluate(capturePage, stroke);
		return await renderAnnotation({ capture, viewport: VIEWPORT, stroke, projectDir: dir });
	} finally {
		await page.close();
	}
}

async function pixelAt(png: Buffer, x: number, y: number) {
	const page = await browser.newPage();
	try {
		await page.setContent(`<img src="data:image/png;base64,${png.toString("base64")}">`);
		return await page.evaluate(
			async ([x, y]) => {
				const img = document.querySelector("img")!;
				await img.decode();
				const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
				const ctx = canvas.getContext("2d")!;
				ctx.drawImage(img, 0, 0);
				return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
			},
			[x, y],
		);
	} finally {
		await page.close();
	}
}

const html = (r: { elements: { html: string }[] }) => r.elements.map((e) => e.html).join("\n");

test("annotation shows the circled element with selector and source location, plus a PNG screenshot", async () => {
	const result = await annotateAfter(async () => {}, ellipse(360, 320));

	assert.equal(result.png.subarray(1, 4).toString(), "PNG");
	const buy = result.elements.find((e) => e.selector.includes("#buy"));
	assert.ok(buy, JSON.stringify(result.elements));
	assert.match(buy.html, /Buy now/);
	assert.ok(buy.sources.includes("index.html:5"), JSON.stringify(buy.sources));
	assert.doesNotMatch(html(result), /Title far away/);
});

test("after opening a modal, circling its button targets the modal, in both elements and image", async () => {
	const result = await annotateAfter((page) => page.click("#open"), ellipse(360, 320));

	assert.match(html(result), /id="confirm"/);
	assert.doesNotMatch(html(result), /id="buy"/);
	assert.deepEqual(await pixelAt(result.png, 310, 320), [0, 255, 0]);
});

test("after scrolling the window and an inner container, the circled element is the one on screen", async () => {
	const scrollBoth = (page: import("playwright").Page) =>
		page.evaluate(() => {
			window.scrollTo(0, 900);
			document.getElementById("box")!.scrollTop = 950;
		});
	const result = await annotateAfter(scrollBoth, ellipse(360, 170));

	assert.deepEqual(
		result.elements.map((e) => e.selector),
		["button#deep"],
	);
	assert.deepEqual(await pixelAt(result.png, 310, 170), [0, 0, 255]);
});
