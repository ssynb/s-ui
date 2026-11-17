import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectSession } from "../server/project-session.ts";
import type { SessionEvent } from "../server/protocol.ts";
import { startFakeLlm } from "./fake-llm.ts";

const replay = (session: ProjectSession) => {
	const events: SessionEvent[] = [];
	session.subscribe((e) => events.push(e))();
	return events;
};

test("while design settings are being organized the session says so, also to late subscribers, and rejected messages carry a code the UI can translate", async (t) => {
	const llm = await startFakeLlm(await mkdtemp(join(tmpdir(), "s-ui-pi-")));
	t.after(llm.close);
	const session = await ProjectSession.open({
		dir: await mkdtemp(join(tmpdir(), "s-ui-proj-")),
		modelRuntime: llm.modelRuntime,
		model: llm.modelRuntime.getModel("fake", "fake-1")!,
		sessionsDir: await mkdtemp(join(tmpdir(), "s-ui-sessions-")),
	});
	t.after(() => session.dispose());
	const live: SessionEvent[] = [];
	session.subscribe((e) => live.push(e));

	let release!: () => void;
	const organizing = session.runExclusive("organizing", () => new Promise<void>((r) => (release = r)));
	await new Promise((r) => setImmediate(r));
	assert.ok(live.some((e) => e.type === "exclusive" && e.task === "organizing"));
	assert.ok(replay(session).some((e) => e.type === "exclusive" && e.task === "organizing"));

	await session.prompt("hi");
	assert.ok(live.some((e) => e.type === "error" && e.code === "busy:organizing"));

	release();
	await organizing;
	assert.deepEqual(live.filter((e) => e.type === "exclusive").at(-1), { type: "exclusive" });
	assert.ok(!replay(session).some((e) => e.type === "exclusive" && e.task));
});
