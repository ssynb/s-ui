import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 截图缓存放在 s-ui 自己的目录里；测试用临时目录，必须在加载模块前设好。
process.env.S_UI_HOME = await mkdtemp(join(tmpdir(), "s-ui-refs-home-"));
const { dispatchModule, MODULES } = await import("../server/modules.ts");
type ModuleContext = import("../server/modules.ts").ModuleContext;

const PAGES: Record<string, { status: number; html: string }> = {
	"/product": {
		status: 200,
		html: `<title>Acme — Ship faster</title><h1>Ship faster with Acme</h1><p>${"The platform teams use to build and ship great products. ".repeat(20)}</p>`,
	},
	// 错误页和登录页都带足够的正文，确保是被各自的规则识别，而不是被当成空页。
	"/missing": { status: 404, html: `<title>Acme</title><h1>Acme</h1><p>${"Browse our products, read the docs or contact support for help. ".repeat(3)}</p>` },
	"/soft-404": { status: 200, html: `<title>Page not found</title><h1>Sorry, we couldn't find that page</h1><p>${"Browse our products, read the docs or contact support for help. ".repeat(3)}</p>` },
	"/welcome": {
		status: 200,
		html: `<title>Acme</title><form><h1>Welcome back</h1><p>${"Browse our products, read the docs or contact support for help. ".repeat(3)}</p><input name="email"><input type="password" name="pw"><button>Continue</button></form>`,
	},
};

let server: Server;
let base: string;
before(async () => {
	server = createServer((req, res) => {
		const page = PAGES[req.url ?? ""] ?? PAGES["/missing"]!;
		res.writeHead(page.status, { "content-type": "text/html; charset=utf-8" }).end(page.html);
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const ctx = { progress: () => {} } as unknown as ModuleContext;
type Capture = { ok: true; url: string; title: string; image: string } | { ok: false; url: string; reason: string; detail: string };
const capture = (url: string) => dispatchModule(MODULES, { module: "references", action: "capture", payload: { url } }, ctx) as Promise<Capture>;
const isJpeg = (base64: string) => Buffer.from(base64, "base64").subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));

test("a real page is captured as a screenshot; unreachable, error and login-wall pages are dropped", async () => {
	const good = await capture(`${base}/product`);
	assert.equal(good.ok, true, JSON.stringify(good));
	assert.ok(good.ok && isJpeg(good.image));
	assert.equal(good.ok && good.title, "Acme — Ship faster");

	const dropped = { "/missing": "http-error", "/soft-404": "error-page", "/welcome": "login" };
	for (const [path, reason] of Object.entries(dropped)) {
		const bad = await capture(`${base}${path}`);
		assert.equal(bad.ok ? "kept" : bad.reason, reason, `${path} should be dropped as ${reason}`);
	}
	const unreachable = await capture("http://127.0.0.1:9/");
	assert.equal(unreachable.ok ? "kept" : unreachable.reason, "unreachable");
});

test("a page captured once is served from the cache without opening the site again", async () => {
	const url = `${base}/product?cached`;
	PAGES["/product?cached"] = PAGES["/product"]!;
	const first = await capture(url);
	assert.equal(first.ok, true);

	delete PAGES["/product?cached"];
	const second = await capture(url);
	assert.equal(second.ok, true, "served from cache although the site now returns 404");
	assert.equal(second.ok && first.ok && second.image, first.ok && first.image);
});
