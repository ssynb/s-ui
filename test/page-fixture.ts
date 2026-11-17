// 测试用的“项目页面”：常见组件各有几个，用到设计变量，便于检验识别与预览操作。
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export const PAGE = `<!doctype html>
<html><head><style>
:root { --sui-color-primary: #3574f0; --sui-radius-md: 6px; }
body { margin: 0; font-family: Georgia, serif; color: #222; }
nav.top { display: flex; gap: 12px; padding: 12px; }
.btn { background: var(--sui-color-primary); color: #fff; border: 0; border-radius: var(--sui-radius-md); padding: 8px 14px; }
.card { width: 200px; height: 120px; margin: 8px; display: inline-block; border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,.1); background: #fff; }
input { padding: 6px; }
</style></head>
<body>
<nav class="top"><a href="#a">Home</a><a href="#b">Pricing</a><a href="#c">Docs</a></nav>
<h1>Ship faster</h1>
<button class="btn" id="primary">Start</button><button class="btn">Learn more</button><button class="btn">Contact</button>
<div><input placeholder="Email"><input placeholder="Name"></div>
<div class="card"><h3>One</h3><p>First plan</p></div><div class="card"><h3>Two</h3><p>Second plan</p></div><div class="card"><h3>Three</h3><p>Third plan</p></div>
</body></html>`;

export async function servePage(html = PAGE) {
	const server = createServer((_req, res) => {
		res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
		res.end(html);
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close: () => server.close() };
}
