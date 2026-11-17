import { type TestContext, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { DESIGN_TOKENS, TOKENS_FILE } from "../server/design-tokens.ts";
import { organizeTokens } from "../server/organize-tokens.ts";
import { type ChatRequest, startFakeLlm } from "./fake-llm.ts";

const STYLE = "body { margin: 0; background: #ffffff; color: #111111; } h1 { color: #3574f0; }";
const HTML = `<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head><body><h1>Hello</h1></body></html>`;

/** 一个直接从磁盘读文件的静态“预览”，AI 改了文件后刷新就能看到。 */
async function serveProject(t: TestContext, dir: string) {
	const server = createServer(async (req, res) => {
		const path = join(dir, req.url === "/" ? "index.html" : req.url!);
		if (!existsSync(path)) return res.writeHead(404).end();
		res.writeHead(200, { "content-type": extname(path) === ".css" ? "text/css" : "text/html" });
		res.end(await readFile(path));
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	t.after(() => server.close());
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

const TOKENS = `:root {\n${DESIGN_TOKENS.map((tk) => `  ${tk.name}: 0;`).join("\n")}\n}\n`;

test("if organizing changes how the page looks and the AI cannot fix it, every change is undone", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-organize-"));
	await mkdir(join(dir, "src"));
	await writeFile(join(dir, "index.html"), HTML);
	await writeFile(join(dir, "src/style.css"), STYLE);
	const previewUrl = await serveProject(t, dir);

	// 假模型：第一轮写出设计变量文件、同时把页面背景改坏；之后（包括被要求修复时）只回一句话。
	const breakPage = `printf '%s' '${TOKENS}' > ${TOKENS_FILE} && printf '%s' 'body { margin: 0; background: #ff0000; }' > src/style.css`;
	let turns = 0;
	const respond = (body: ChatRequest) => (turns++ === 0 && body.messages.at(-1)!.role !== "tool" ? { tool: "bash", args: { command: breakPage } } : { text: "done" });
	const llm = await startFakeLlm(await mkdtemp(join(tmpdir(), "s-ui-pi-")), {}, respond);
	t.after(llm.close);

	const result = await organizeTokens({ dir, model: llm.modelRuntime.getModel("fake", "fake-1")!, previewUrl }, llm.modelRuntime, () => {});

	assert.equal(result.appearanceUnchanged, false);
	assert.equal(result.organized, false);
	assert.deepEqual(result.changedFiles, []);
	assert.equal(await readFile(join(dir, "src/style.css"), "utf8"), STYLE);
	assert.equal(existsSync(join(dir, TOKENS_FILE)), false);
	assert.ok(llm.requests.length >= 3, "the AI was asked to fix the regression before giving up");
});
