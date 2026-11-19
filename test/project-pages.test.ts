import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

let server: ChildProcess;
let browser: Browser;
let root: string;
let url: string;
before(async () => {
 root = await mkdtemp(join(tmpdir(), "s-ui-pages-test-"));
 server = spawn(process.execPath, ["server/main.ts", "--no-open", "--port", "0"], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, S_UI_HOME: join(root, "home") } });
 url = await new Promise<string>((resolve) => server.stdout!.on("data", d => { const m = String(d).match(/http:\/\/127\.0\.0\.1:\d+\//); if (m) resolve(m[0]); }));
 browser = await chromium.launch();
});
after(async () => { await browser?.close(); if (server && server.exitCode === null) { const ended = new Promise(resolve => server.once("exit", resolve)); server.kill("SIGTERM"); await ended; } await rm(root, { recursive: true, force: true }); });

async function fixture(dir: string, routes: string[], app = "app") {
 await mkdir(join(dir, "node_modules"), { recursive: true });
 await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module", dependencies: { next: "16" }, scripts: { dev: "node serve.js" } }));
 await writeFile(join(dir, "serve.js"), `import {createServer} from 'node:http'; import {writeFileSync} from 'node:fs'; writeFileSync('started','yes'); const s=createServer((q,r)=>{r.writeHead(q.url==='/broken'?500:200,{'content-type':'text/html'});r.end('<html><body style="min-height:1600px"><h1>Live '+q.url+'</h1><button>Real button</button></body></html>')});s.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+s.address().port));`);
 for (const route of routes) { const folder = join(dir, app, route); await mkdir(folder, { recursive: true }); await writeFile(join(folder, "page.tsx"), "export default function Page() { return null }"); }
}
async function open(page: Page, dir: string) {
 await page.getByRole("button", { name: "Open folder…" }).click();
 const path = page.getByRole("textbox", { name: "Folder path" }); await path.fill(dir); await path.press("Enter");
 await page.getByRole("tree", { name: dir, exact: true }).waitFor();
 await page.getByRole("button", { name: "Open", exact: true }).click();
}
async function pageFor(t: { after: (fn: () => Promise<void>) => void }) { const page = await browser.newPage({ locale: "en-US" }); page.setDefaultTimeout(8000); t.after(() => page.close()); await page.goto(url); return page; }

test("parent choice starts only the chosen project; route thumbnails open full pages and select live routes, including failed captures", async t => {
 const parent = join(root, "multiple");
 await fixture(join(parent, "claims"), ["", "(work)/claims", "broken", "[id]", "_private", "@slot", "(.)intercept"]);
 await fixture(join(parent, "tracking"), [""]);
 await fixture(join(parent, ".hidden"), [""]);
 await fixture(join(parent, "node_modules"), [""]);
 const page = await pageFor(t); await open(page, parent);
 const chooser = page.getByRole("dialog", { name: "Choose project" }); await chooser.waitFor();
 assert.deepEqual(await chooser.getByRole("button").allTextContents(), ["claims", "tracking", "Cancel"]);
 await assert.rejects(access(join(parent, "claims", "started")));
 await chooser.getByRole("button", { name: "claims", exact: true }).click();
 const pages = page.getByRole("region", { name: "Choose page" }); await pages.waitFor();
 assert.deepEqual(await pages.getByRole("button", { name: /^Open full/ }).allTextContents().then(x => x.length), 3);
 await pages.getByRole("button", { name: "Open full page: /claims", exact: true }).click();
 const viewer = page.getByRole("dialog", { name: "/claims", exact: true }); await viewer.getByRole("img", { name: "/claims", exact: true }).waitFor();
 await viewer.getByRole("button", { name: "Select this page" }).click();
 await page.frameLocator('iframe[title="Preview"]').getByRole("heading", { name: "Live /claims", exact: true }).waitFor();
 await page.getByRole("tab", { name: "Polish", exact: true }).click();
 await page.getByRole("button", { name: "Change page" }).click();
 await page.getByRole("button", { name: "Open full page: /broken", exact: true }).click();
 const failed = page.getByRole("dialog", { name: "/broken", exact: true }); await failed.getByText(/Screenshot unavailable/).waitFor();
 await failed.getByRole("button", { name: "Select this page" }).click();
 await page.frameLocator('iframe[title="Preview"]').getByRole("heading", { name: "Live /broken", exact: true }).waitFor();
 await assert.rejects(access(join(parent, "tracking", "started")));
});

test("one direct child and one src/app grouped page enter live preview without choosing", async t => {
 const parent = join(root, "single"); await fixture(join(parent, "only"), ["(group)/tracking"], "src/app");
 const page = await pageFor(t); await open(page, parent);
 await page.frameLocator('iframe[title="Preview"]').getByRole("heading", { name: "Live /tracking", exact: true }).waitFor();
 assert.equal(await page.getByRole("button", { name: "Change page" }).count(), 0);
});

test("files without a dev entry are not an empty project; truly empty folders retain the starting flow", async t => {
 const filled = join(root, "no-entry"); const empty = join(root, "empty"); await mkdir(filled); await mkdir(empty); await writeFile(join(filled, "notes.txt"), "not an app");
 const page = await pageFor(t); await open(page, filled);
 await page.getByText("No startup entry found", { exact: true }).waitFor();
 assert.equal(await page.getByRole("button", { name: "Find similar" }).count(), 0);
 await open(page, empty);
 await page.getByText("No startup entry found", { exact: true }).waitFor({ state: "hidden" });
 await page.getByRole("textbox", { name: /Describe/ }).first().waitFor();
 assert.equal(await page.locator("iframe").count(), 0);
});
