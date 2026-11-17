import { type TestContext, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TOKENS_FILE } from "../server/design-tokens.ts";
import { organizeTokens } from "../server/organize-tokens.ts";
import { ProjectSession } from "../server/project-session.ts";
import type { SessionEvent } from "../server/protocol.ts";
import { type ChatRequest, type FakeReply, startFakeLlm } from "./fake-llm.ts";

const STYLE = "h1 { color: #3574f0; }";

async function project() {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-organize-"));
	await mkdir(join(dir, "src"));
	await writeFile(join(dir, "src/style.css"), STYLE);
	return dir;
}

async function fakeModel(t: TestContext, respond: (body: ChatRequest) => FakeReply) {
	const llm = await startFakeLlm(await mkdtemp(join(tmpdir(), "s-ui-pi-")), {}, respond);
	t.after(llm.close);
	return { llm, model: llm.modelRuntime.getModel("fake", "fake-1")! };
}

const exclusive = <T>(_task: string, fn: () => Promise<T>) => fn();

test("if the AI fails after it has already edited files, organizing undoes those edits", async (t) => {
	const dir = await project();
	const writeThenFail = (body: ChatRequest): FakeReply =>
		body.messages.at(-1)!.role === "tool" ? { httpError: 400 } : { tool: "bash", args: { command: `printf 'broken' > src/style.css && printf ':root{}' > ${TOKENS_FILE}` } };
	const { llm, model } = await fakeModel(t, writeThenFail);

	await assert.rejects(organizeTokens({ dir, model, exclusive }, llm.modelRuntime, () => {}));
	assert.equal(await readFile(join(dir, "src/style.css"), "utf8"), STYLE);
	assert.equal(existsSync(join(dir, TOKENS_FILE)), false);
});

test("organizing runs only while the chat AI is idle, and chat messages are refused meanwhile instead of editing files at the same time", async (t) => {
	const dir = await project();
	const { llm, model } = await fakeModel(t, () => ({ text: "ok" }));
	const session = await ProjectSession.open({ dir, modelRuntime: llm.modelRuntime, model, sessionsDir: await mkdtemp(join(tmpdir(), "s-ui-sessions-")) });
	t.after(() => session.dispose());
	const events: SessionEvent[] = [];
	session.subscribe((e) => events.push(e));

	let release!: () => void;
	const organizing = session.runExclusive("organize", () => new Promise<void>((r) => (release = r)));
	await new Promise((r) => setImmediate(r));
	await session.prompt("change the header");
	assert.equal(llm.requests.length, 0, "the chat message must not reach the AI while organizing");
	assert.ok(events.some((e) => e.type === "error" && /organiz/i.test(e.message)));
	await assert.rejects(session.runExclusive("organize", async () => {}), /organiz/i);

	release();
	await organizing;
	await session.prompt("change the header");
	assert.equal(llm.requests.length, 1);
});
