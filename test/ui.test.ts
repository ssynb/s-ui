import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import WebSocket from "ws";

const PORT = 5196;
const URL = `http://127.0.0.1:${PORT}/`;
let server: ChildProcess;
let browser: Browser;

before(async () => {
	const appHome = await mkdtemp(join(tmpdir(), "s-ui-home-"));
	server = spawn(process.execPath, ["server/main.ts", "--no-open", "--port", String(PORT)], {
		stdio: ["ignore", "pipe", "inherit"],
		env: { ...process.env, S_UI_HOME: appHome },
	});
	await new Promise<void>((resolve) => server.stdout!.on("data", (d) => String(d).includes("running") && resolve()));
	browser = await chromium.launch();
});
after(async () => {
	await browser.close();
	server.kill("SIGTERM");
});

/** 另一个连接打开一个项目，让服务端向所有页面推送最近项目更新。 */
async function openProjectElsewhere(dir: string) {
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: URL.slice(0, -1) });
	await new Promise<void>((resolve) =>
		ws.on("message", (d) => {
			const msg = JSON.parse(String(d));
			if (msg.type === "hello") ws.send(JSON.stringify({ type: "open", requestId: "r", dir, model: msg.defaultModel }));
			if (msg.type === "opened") resolve();
		}),
	);
	ws.close();
}

test("the folder picker keeps where the user browsed to when unrelated updates arrive", async () => {
	const browsed = await mkdtemp(join(tmpdir(), "s-ui-browse-"));
	const page = await browser.newPage({ locale: "en-US" });
	await page.goto(URL);
	await page.getByRole("button", { name: "Open folder…" }).click();
	const path = page.getByRole("textbox", { name: "Folder path" });
	await path.fill(browsed);
	await path.press("Enter");
	await page.getByRole("tree", { name: browsed }).waitFor();

	const other = await mkdtemp(join(tmpdir(), "s-ui-other-"));
	await openProjectElsewhere(other);
	// 最近项目更新已到达页面（欢迎页列表在对话框后面同步更新）。
	await page.getByText(other.split("/").at(-1)!, { exact: true }).waitFor({ state: "attached" });

	assert.equal(await path.inputValue(), browsed);
	await page.close();
});
