import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { dispatchModule, MODULES, type ModuleContext } from "../server/modules.ts";
import type { FindResult } from "../server/modules/references.ts";

// 一个网站：/shop 是正常页面，/gone 返回 404。
let site: Server;
let siteUrl: string;
// 本地假模型：把收到的请求记下来，回一段固定的找同类 JSON（候选指向上面的网站）。
let llm: Server;
const prompts: string[] = [];
let modelRuntime: ModelRuntime;

const listen = async (server: Server) => {
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

function answer() {
	return JSON.stringify({
		product: { kind: "Coffee shop", page: "Landing page", summary: "A specialty coffee shop website" },
		candidates: [
			{ name: "Good Beans", url: `${siteUrl}/shop`, why: "Warm photography" },
			{ name: "Gone Beans", url: `${siteUrl}/gone`, why: "Nice type" },
		],
	});
}

before(async () => {
	site = createServer((req, res) => {
		if (req.url === "/shop") {
			res.writeHead(200, { "content-type": "text/html" }).end(`<title>Good Beans</title><h1>Good Beans</h1><p>${"Single origin coffee roasted weekly. ".repeat(20)}</p>`);
		} else res.writeHead(404, { "content-type": "text/html" }).end("<title>Not found</title>");
	});
	siteUrl = await listen(site);

	llm = createServer(async (req, res) => {
		let raw = "";
		for await (const part of req) raw += part;
		const body = JSON.parse(raw) as { model: string; messages: { content: unknown }[] };
		prompts.push(JSON.stringify(body.messages));
		const chunk = (delta: object, finish: string | null = null) =>
			`data: ${JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
		res.writeHead(200, { "content-type": "text/event-stream" });
		res.end(chunk({ role: "assistant", content: answer() }) + chunk({}, "stop") + "data: [DONE]\n\n");
	});
	const base = await listen(llm);
	const dir = await mkdtemp(join(tmpdir(), "s-ui-refs-llm-"));
	const model = { id: "fake-1", input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
	await writeFile(join(dir, "models.json"), JSON.stringify({ providers: { fake: { baseUrl: `${base}/v1`, api: "openai-completions", apiKey: "test", models: [model] } } }));
	await writeFile(join(dir, "auth.json"), "{}");
	modelRuntime = await ModelRuntime.create({ authPath: join(dir, "auth.json"), modelsPath: join(dir, "models.json") });
});
after(() => {
	site.close();
	llm.close();
});

test("in a project with no page yet, finding similar products works from the user's description and keeps only pages that open", async () => {
	const emptyProject = await mkdtemp(join(tmpdir(), "s-ui-empty-project-"));
	const ctx: ModuleContext = { modelRuntime, project: { dir: emptyProject, model: modelRuntime.getModel("fake", "fake-1")! }, progress: () => {} };
	const description = "an online shop for my specialty coffee roastery";

	const result = (await dispatchModule(MODULES, { module: "references", action: "findSimilar", payload: { locale: "en", description } }, ctx)) as FindResult;

	assert.ok(prompts.some((p) => p.includes(description)), "the AI is told what the user wants to build");
	assert.deepEqual(
		result.references.map((r) => r.name),
		["Good Beans"],
	);
	assert.deepEqual(
		result.dropped.map((d) => [d.url, d.reason]),
		[[`${siteUrl}/gone`, "http-error"]],
	);
});
