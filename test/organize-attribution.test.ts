import { type TestContext, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { TOKENS_FILE } from "../server/design-tokens.ts";
import { organizeTokens } from "../server/organize-tokens.ts";
import { type ChatRequest, type FakeReply, startFakeLlm } from "./fake-llm.ts";

// 整理撤销只撤整理自己写的：整理期间编辑器或别的程序对项目的改动必须保留。
const STYLE = "h1 { color: #3574f0; }";
const OTHER = "p { color: #333333; }";
const exclusive = <T>(_task: string, fn: () => Promise<T>) => fn();

async function project(t: TestContext) {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-attrib-"));
	await mkdir(join(dir, "src"));
	await writeFile(join(dir, "index.html"), `<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head><body><h1>Hi</h1></body></html>`);
	await writeFile(join(dir, "src/style.css"), STYLE);
	await writeFile(join(dir, "src/other.css"), OTHER);
	const server = createServer(async (req, res) => {
		const path = join(dir, req.url === "/" ? "index.html" : req.url!);
		if (!existsSync(path)) return res.writeHead(404).end();
		res.writeHead(200, { "content-type": extname(path) === ".css" ? "text/css" : "text/html" }).end(await readFile(path));
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	t.after(() => server.close());
	return { dir, previewUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` };
}

/** 整理用的 AI：先写设计变量文件和一份 extra.css，再把 style.css 改坏；随后 outcome 决定最后一轮。 */
function scriptedOrganizer(dir: string, outcome: FakeReply, duringLastTurn: () => Promise<void>) {
	const script: FakeReply[] = [
		{ tool: "write", args: { path: TOKENS_FILE, content: ":root { --sui-color-primary: red; }" } },
		{ tool: "write", args: { path: "src/extra.css", content: "/* organizer */" } },
		{ tool: "write", args: { path: "src/style.css", content: "body { background: #ff0000; }" } },
	];
	let externalDone = false;
	return async (body: ChatRequest): Promise<FakeReply> => {
		const step = body.messages.filter((m) => m.role === "tool").length;
		if (step < script.length) return script[step]!;
		if (!externalDone) {
			externalDone = true;
			await duringLastTurn();
		}
		return outcome;
	};
}

async function externalEdits(dir: string) {
	await writeFile(join(dir, "src/other.css"), "p { color: #000000; } /* edited in the editor */");
	await writeFile(join(dir, "src/user-new.css"), "/* created by the user */");
	await writeFile(join(dir, "src/extra.css"), "/* the user changed a file the AI had written */");
}

async function assertExternalKept(dir: string) {
	assert.equal(await readFile(join(dir, "src/other.css"), "utf8"), "p { color: #000000; } /* edited in the editor */");
	assert.equal(await readFile(join(dir, "src/user-new.css"), "utf8"), "/* created by the user */");
	assert.equal(await readFile(join(dir, "src/extra.css"), "utf8"), "/* the user changed a file the AI had written */");
	assert.equal(await readFile(join(dir, "src/style.css"), "utf8"), STYLE);
	assert.equal(existsSync(join(dir, TOKENS_FILE)), false);
}

async function organizeWith(t: TestContext, dir: string, previewUrl: string, respond: (body: ChatRequest) => Promise<FakeReply>) {
	const llm = await startFakeLlm(await mkdtemp(join(tmpdir(), "s-ui-pi-")), {}, respond);
	t.after(llm.close);
	return organizeTokens({ dir, model: llm.modelRuntime.getModel("fake", "fake-1")!, previewUrl, exclusive }, llm.modelRuntime, () => {});
}

test("undoing an organize that changed the look keeps edits made to the project by others meanwhile", async (t) => {
	const { dir, previewUrl } = await project(t);
	const result = await organizeWith(t, dir, previewUrl, scriptedOrganizer(dir, { text: "could not fix" }, () => externalEdits(dir)));
	assert.equal(result.appearanceUnchanged, false);
	await assertExternalKept(dir);
});

test("undoing an organize that failed midway keeps edits made to the project by others meanwhile", async (t) => {
	const { dir, previewUrl } = await project(t);
	await assert.rejects(organizeWith(t, dir, previewUrl, scriptedOrganizer(dir, { httpError: 400 }, () => externalEdits(dir))));
	await assertExternalKept(dir);
});
