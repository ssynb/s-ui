import { createServer, request } from "node:http";
import { connect, type AddressInfo, type Socket } from "node:net";
import { DESIGN_TOKENS } from "./design-tokens.ts";
import { capturePage } from "./page-capture.ts";
import { inspectPage } from "./page-inspect.ts";
import { STYLE_LAYER } from "./modules/style-scope.ts";
import { installPreviewOps } from "./preview-ops.ts";
import { PAGE_CAPTURE_MESSAGE, PREVIEW_OP_MESSAGE } from "./protocol.ts";


// 预览 iframe 与工作台不同源，工作台读不到里面的页面；注入这段脚本，只应工作台页面的请求：
// 在用户此刻的真实页面上采集圈注现场，以及执行预览操作（临时样式层、字体、识别组件、读设计变量）。
function bridgeScript(appOrigins: string[]) {
	const type = JSON.stringify(PAGE_CAPTURE_MESSAGE);
	const opsConfig = `{ allowed, styleLayer: ${JSON.stringify(STYLE_LAYER)}, type: ${JSON.stringify(PREVIEW_OP_MESSAGE)}, tokenNames: ${JSON.stringify(DESIGN_TOKENS.map((t) => t.name))}, inspect: inspectPage }`;
	return `<script>(() => {
const allowed = ${JSON.stringify(appOrigins)};
const capturePage = (${capturePage.toString()});
const inspectPage = (${inspectPage.toString()});
addEventListener("message", (e) => {
	if (e.source !== parent || !allowed.includes(e.origin) || e.data?.type !== ${type}) return;
	parent.postMessage({ type: ${type}, id: e.data.id, capture: capturePage(e.data.stroke) }, e.origin);
});
const start = () => (${installPreviewOps.toString()})(${opsConfig});
// 样式层要挂在 <html> 末尾，等文档解析完再装。
if (document.readyState === "loading") addEventListener("DOMContentLoaded", start, { once: true });
else start();
})();</script>`;
}

function injectInto(html: string, script: string) {
	const head = html.match(/<head[^>]*>/i);
	return head ? html.replace(head[0], head[0] + script) : script + html;
}

export type PreviewProxy = { url: string; close: () => Promise<void> };

/** 在随机本地端口上反向代理 dev server（含 HMR 的 WebSocket），并向 HTML 注入状态桥接脚本。 */
export async function startPreviewProxy(target: string, appOrigins: string[]): Promise<PreviewProxy> {
	const { hostname, port, host } = new URL(target);
	const script = bridgeScript(appOrigins);
	const sockets = new Set<Socket>();

	const server = createServer((req, res) => {
		const headers = { ...req.headers, host, "accept-encoding": "identity" };
		const upstream = request({ hostname, port, path: req.url, method: req.method, headers }, (up) => {
			if (!up.headers["content-type"]?.includes("text/html")) {
				res.writeHead(up.statusCode!, up.headers);
				up.pipe(res);
				return;
			}
			const chunks: Buffer[] = [];
			up.on("data", (c: Buffer) => chunks.push(c));
			up.on("end", () => {
				const { "content-length": _length, ...rest } = up.headers;
				res.writeHead(up.statusCode!, rest);
				res.end(injectInto(Buffer.concat(chunks).toString("utf8"), script));
			});
		});
		upstream.on("error", (error) => {
			res.writeHead(502);
			res.end(error.message);
		});
		req.pipe(upstream);
	});

	server.on("upgrade", (req, socket: Socket, head) => {
		const upstream = connect(Number(port), hostname, () => {
			const lines = [`${req.method} ${req.url} HTTP/1.1`];
			for (let i = 0; i < req.rawHeaders.length; i += 2) {
				const name = req.rawHeaders[i]!;
				lines.push(`${name}: ${name.toLowerCase() === "host" ? host : req.rawHeaders[i + 1]}`);
			}
			upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
			upstream.write(head);
			socket.pipe(upstream).pipe(socket);
		});
		for (const s of [socket, upstream]) {
			sockets.add(s);
			s.on("close", () => sockets.delete(s));
		}
		upstream.on("error", () => socket.destroy());
		socket.on("error", () => upstream.destroy());
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
		close: () =>
			new Promise<void>((resolve) => {
				for (const s of sockets) s.destroy();
				server.close(() => resolve());
				server.closeAllConnections();
			}),
	};
}
