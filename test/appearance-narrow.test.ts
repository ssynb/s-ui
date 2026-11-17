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

const STYLE = "body { margin: 0; background: #ffffff; }";

async function serve(t: TestContext, dir: string) {
	const server = createServer(async (req, res) => {
		const path = join(dir, req.url === "/" ? "index.html" : req.url!);
		if (!existsSync(path)) return res.writeHead(404).end();
		res.writeHead(200, { "content-type": extname(path) === ".css" ? "text/css" : "text/html" }).end(await readFile(path));
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	t.after(() => server.close());
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

test("organizing that only breaks the page on a phone-sized screen is caught and undone", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-narrow-"));
	await mkdir(join(dir, "src"));
	await writeFile(join(dir, "index.html"), `<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/src/style.css"></head><body><h1>Hi</h1></body></html>`);
	await writeFile(join(dir, "src/style.css"), STYLE);
	const previewUrl = await serve(t, dir);

	const script = [
		{ tool: "write", args: { path: TOKENS_FILE, content: `:root {\n${DESIGN_TOKENS.map((tk) => `  ${tk.name}: 0;`).join("\n")}\n}\n` } },
		{ tool: "write", args: { path: "src/style.css", content: `${STYLE} @media (max-width: 600px) { body { background: #ff0000; } }` } },
	];
	const respond = (body: ChatRequest) => script[body.messages.filter((m) => m.role === "tool").length] ?? { text: "done" };
	const llm = await startFakeLlm(await mkdtemp(join(tmpdir(), "s-ui-pi-")), {}, respond);
	t.after(llm.close);
	const exclusive = <T>(_task: string, fn: () => Promise<T>) => fn();

	const result = await organizeTokens({ dir, model: llm.modelRuntime.getModel("fake", "fake-1")!, previewUrl, exclusive }, llm.modelRuntime, () => {});
	assert.equal(result.appearanceUnchanged, false);
	assert.equal(await readFile(join(dir, "src/style.css"), "utf8"), STYLE);
});
