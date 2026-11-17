import { type TestContext, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectSession } from "../server/project-session.ts";
import type { SessionEvent } from "../server/protocol.ts";
import { startFakeLlm } from "./fake-llm.ts";

const RED_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const FAR_FUTURE = Date.now() + 365 * 24 * 3600 * 1000;

const tempDir = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

async function setup(t: TestContext, extraAuth: object = {}) {
	const [project, sessionsDir, piDir] = await Promise.all([tempDir("s-ui-proj-"), tempDir("s-ui-sessions-"), tempDir("s-ui-pi-")]);
	const llm = await startFakeLlm(piDir, extraAuth);
	t.after(llm.close);
	const model = llm.modelRuntime.getModel("fake", "fake-1")!;
	// 失败时也要释放会话，测试进程才能退出。
	const open = async () => {
		const session = await ProjectSession.open({ dir: project, modelRuntime: llm.modelRuntime, model, sessionsDir });
		t.after(() => session.dispose());
		return session;
	};
	return { llm, open };
}

/** 订阅时会话把当前对话重放一遍；收集重放出来的事件。 */
function replay(session: ProjectSession) {
	const events: SessionEvent[] = [];
	session.subscribe((e) => events.push(e))();
	return events;
}

function untilIdle(session: ProjectSession) {
	return new Promise<void>((resolve) => {
		const off = session.subscribe((e) => {
			if (e.type === "busy" && !e.busy) {
				off();
				resolve();
			}
		});
	});
}

async function say(session: ProjectSession, text: string, images = 0) {
	const idle = untilIdle(session);
	await session.prompt(text, { images: Array.from({ length: images }, () => ({ data: RED_PIXEL_PNG, mimeType: "image/png" as const })) });
	await idle;
}

const chat = (events: SessionEvent[]) =>
	events.flatMap((e) => {
		if (e.type === "user") return [`user:${e.text}:${e.images.length}img`];
		if (e.type === "tool") return [`tool-${e.phase}:${e.name}`];
		if (e.type === "assistant_delta") return [`ai:${e.text}`];
		return [];
	});

test("a conversation comes back after reopening the project, with tool calls and images, and the AI keeps its context", async (t) => {
	const { llm, open } = await setup(t);
	const first = await open();
	await say(first, "please use a tool", 1);
	await first.dispose();

	const reopened = await open();
	assert.deepEqual(chat(replay(reopened)), ["user:please use a tool:1img", "tool-start:bash", "tool-end:bash", "ai:done"]);

	await say(reopened, "and now?");
	assert.match(JSON.stringify(llm.requests.at(-1)!.messages), /please use a tool/);
	await reopened.dispose();
});

test("switching the model applies from the next message and is remembered; Claude subscription models are refused", async (t) => {
	const { llm, open } = await setup(t, { anthropic: { type: "oauth", access: "sk-ant-oat01-test", refresh: "r", expires: FAR_FUTURE } });
	const session = await open();
	await say(session, "hello");
	await session.setModel(llm.modelRuntime.getModel("fake", "fake-2")!);
	await say(session, "hello again");
	assert.deepEqual(
		llm.requests.map((r) => r.model),
		["fake-1", "fake-2"],
	);
	assert.ok(replay(session).some((e) => e.type === "model" && e.model === "fake/fake-2"));
	await assert.rejects(session.setModel(llm.modelRuntime.getModels("anthropic")[0]!), /OAuth/);
	await session.dispose();

	const reopened = await open();
	assert.ok(replay(reopened).some((e) => e.type === "model" && e.model === "fake/fake-2"));
	await reopened.dispose();
});

test("a new conversation starts empty, earlier ones stay listed and can be switched back to", async (t) => {
	const { llm, open } = await setup(t);
	const session = await open();
	await say(session, "first topic");
	await session.newConversation();
	assert.deepEqual(chat(replay(session)), []);

	await say(session, "second topic");
	const listed = replay(session).findLast((e) => e.type === "conversations");
	assert.deepEqual(
		listed?.type === "conversations" && listed.list.map((c) => c.title),
		["second topic", "first topic"],
	);

	const firstId = listed!.type === "conversations" ? listed!.list[1]!.id : "";
	await session.switchConversation(firstId);
	assert.deepEqual(chat(replay(session)), ["user:first topic:0img", "ai:ok"]);
	await session.dispose();
});
