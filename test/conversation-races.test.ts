import { type TestContext, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectSession } from "../server/project-session.ts";
import type { SessionEvent } from "../server/protocol.ts";
import { startFakeLlm } from "./fake-llm.ts";

const tempDir = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

async function openSession(t: TestContext) {
	const [project, sessionsDir, piDir] = await Promise.all([tempDir("s-ui-proj-"), tempDir("s-ui-sessions-"), tempDir("s-ui-pi-")]);
	const llm = await startFakeLlm(piDir);
	t.after(llm.close);
	const session = await ProjectSession.open({ dir: project, modelRuntime: llm.modelRuntime, model: llm.modelRuntime.getModel("fake", "fake-1")!, sessionsDir });
	t.after(() => session.dispose());
	return { llm, session };
}

function nextIdle(session: ProjectSession) {
	return new Promise<void>((resolve) => {
		const off = session.subscribe((e) => {
			if (e.type === "busy" && !e.busy) {
				off();
				resolve();
			}
		});
	});
}

function userTexts(session: ProjectSession) {
	const events: SessionEvent[] = [];
	session.subscribe((e) => events.push(e))();
	return events.flatMap((e) => (e.type === "user" ? [e.text] : []));
}

test("a message sent right after starting a new conversation lands in the new conversation", async (t) => {
	const { llm, session } = await openSession(t);
	const idle = nextIdle(session);
	await Promise.all([session.newConversation(), session.prompt("NEW TOPIC MESSAGE")]);
	await idle;

	assert.deepEqual(userTexts(session), ["NEW TOPIC MESSAGE"]);
	assert.match(JSON.stringify(llm.requests.at(-1)?.messages), /NEW TOPIC MESSAGE/);
	await session.dispose();
});

test("a failed conversation switch leaves the project usable and closable", async (t) => {
	const { session } = await openSession(t);
	await assert.rejects(session.switchConversation("missing"), /Unknown conversation/);

	await session.newConversation();
	const idle = nextIdle(session);
	await session.prompt("still works");
	await idle;
	assert.deepEqual(userTexts(session), ["still works"]);
	await session.dispose();
});
