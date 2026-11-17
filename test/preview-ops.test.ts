import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { type Browser, chromium, type Frame, type Page } from "playwright";
import { type PreviewProxy, startPreviewProxy } from "../server/preview-proxy.ts";
import { PREVIEW_OP_MESSAGE } from "../server/protocol.ts";
import { servePage } from "./page-fixture.ts";

// 模拟工作台：一个来自工作台来源的页面，内嵌经预览代理的项目页面，用 postMessage 操作它。
const workbenchHtml = (previewUrl: string) => `<!doctype html><body style="margin:0">
<iframe id="preview" src="${previewUrl}" style="width:800px;height:600px;border:0"></iframe>
<script>
const TYPE = ${JSON.stringify(PREVIEW_OP_MESSAGE)};
const pending = new Map(); let next = 0;
window.announcements = [];
addEventListener("message", (e) => {
	if (e.data?.type !== TYPE) return;
	if (e.data.event) return window.announcements.push(e.data.event);
	pending.get(e.data.id)?.(e.data); pending.delete(e.data.id);
});
window.op = (op) => new Promise((resolve) => {
	const id = ++next; pending.set(id, resolve);
	document.getElementById("preview").contentWindow.postMessage({ type: TYPE, id, op }, new URL(${JSON.stringify(previewUrl)}).origin);
});
</script></body>`;

let browser: Browser;
let site: Awaited<ReturnType<typeof servePage>>;
let proxy: PreviewProxy;
let workbench: Server;
let workbenchUrl: string;

before(async () => {
	browser = await chromium.launch();
	site = await servePage();
	workbench = createServer((_req, res) => res.end(workbenchHtml(proxy.url)));
	await new Promise<void>((r) => workbench.listen(0, "127.0.0.1", r));
	workbenchUrl = `http://127.0.0.1:${(workbench.address() as AddressInfo).port}`;
	proxy = await startPreviewProxy(site.url, [workbenchUrl]);
});
after(async () => {
	await browser.close();
	await proxy.close();
	workbench.close();
	site.close();
});

async function openWorkbench(): Promise<{ page: Page; frame: Frame; op: (op: object) => Promise<any> }> {
	const page = await browser.newPage();
	await page.goto(workbenchUrl);
	await page.waitForFunction(() => (window as any).announcements.includes("ready"));
	const frame = page.frames().find((f) => f.url().startsWith(proxy.url))!;
	const op = async (o: object) => {
		const reply = await page.evaluate((o) => (window as any).op(o), o);
		if (!reply.ok) throw new Error(reply.error);
		return reply.result;
	};
	return { page, frame, op };
}

const buttonBackground = (frame: Frame) => frame.evaluate(() => getComputedStyle(document.querySelector(".btn")!).backgroundColor);

test("a style layer changes the preview at once, survives a reload and styles added later, and clearAll restores the page", async () => {
	const { page, frame, op } = await openWorkbench();
	assert.equal(await buttonBackground(frame), "rgb(53, 116, 240)");

	await op({ name: "applyLayer", id: "colors", css: ":root { --sui-color-primary: #e11d48; }" });
	assert.equal(await buttonBackground(frame), "rgb(225, 29, 72)");
	assert.equal((await op({ name: "readTokens" }))["--sui-color-primary"], "#e11d48");

	// 热更新会在页面里追加或替换样式；临时样式层仍应在最上面。
	await frame.evaluate(() => document.head.append(Object.assign(document.createElement("style"), { textContent: ":root { --sui-color-primary: #00aa00; }" })));
	assert.equal(await buttonBackground(frame), "rgb(225, 29, 72)");

	await frame.evaluate(() => location.reload());
	await page.waitForFunction(() => (window as any).announcements.filter((e: string) => e === "ready").length >= 2);
	const reloaded = page.frames().find((f) => f.url().startsWith(proxy.url))!;
	assert.equal(await buttonBackground(reloaded), "rgb(225, 29, 72)");

	await op({ name: "clearAll" });
	assert.equal(await buttonBackground(reloaded), "rgb(53, 116, 240)");
	await page.close();
});

test("clearLayer removes only that layer; fonts load as stylesheets; inspect works through the bridge", async () => {
	const { page, frame, op } = await openWorkbench();
	await op({ name: "applyLayer", id: "a", css: ".btn { border-radius: 20px; }" });
	await op({ name: "applyLayer", id: "b", css: ":root { --sui-color-primary: #111111; }" });
	await op({ name: "clearLayer", id: "b" });
	assert.equal(await buttonBackground(frame), "rgb(53, 116, 240)");
	assert.equal(await frame.evaluate(() => getComputedStyle(document.querySelector(".btn")!).borderTopLeftRadius), "20px");

	const fontUrl = `${site.url}fonts.css`;
	await op({ name: "loadFonts", urls: [fontUrl] });
	assert.equal(await frame.locator(`link[rel=stylesheet][href="${fontUrl}"]`).count(), 1);

	const inspection = await op({ name: "inspect" });
	assert.ok(inspection.components.some((c: { kind: string; count: number }) => c.kind === "button" && c.count === 3));
	await op({ name: "clearAll" });
	await page.close();
});

test("pages from other origins cannot operate the preview", async () => {
	const page = await browser.newPage();
	await page.goto(site.url);
	await page.setContent(workbenchHtml(proxy.url));
	await page.waitForTimeout(500);
	const reply = await Promise.race([page.evaluate(() => (window as any).op({ name: "readTokens" })), new Promise((r) => setTimeout(() => r("no reply"), 1500))]);
	assert.equal(reply, "no reply");
	await page.close();
});
