import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { ProjectSession } from "../server/project-session.ts";
import type { SessionEvent } from "../server/protocol.ts";
import { listUsableModels } from "../server/models.ts";

const EXAMPLE = new URL("../examples/hello-page", import.meta.url).pathname;
const FAR_FUTURE = Date.now() + 365 * 24 * 3600 * 1000;

async function runtimeWithAuth(auth: object) {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-auth-"));
	await writeFile(join(dir, "auth.json"), JSON.stringify(auth));
	return ModelRuntime.create({ authPath: join(dir, "auth.json"), modelsPath: join(dir, "models.json") });
}

function nextEvent(session: ProjectSession, match: (e: SessionEvent) => boolean, timeoutMs: number) {
	return new Promise<SessionEvent>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timed out waiting for session event")), timeoutMs);
		const off = session.subscribe((e) => {
			if (!match(e)) return;
			clearTimeout(timer);
			off();
			resolve(e);
		});
	});
}

test("opening an existing front-end project installs deps, starts its dev server and stops it on dispose", async () => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-project-"));
	await cp(EXAMPLE, dir, { recursive: true, filter: (src) => !src.includes("node_modules") });
	const modelRuntime = await runtimeWithAuth({ openai: { type: "api_key", key: "sk-test" } });
	const model = modelRuntime.getModel("openai", "gpt-4o")!;

	const session = await ProjectSession.open({ dir, modelRuntime, model });
	const ready = await nextEvent(session, (e) => e.type === "preview" && (e.state === "ready" || e.state === "error"), 180_000);
	assert.equal(ready.type === "preview" && ready.state, "ready", JSON.stringify(ready));
	const url = (ready as Extract<SessionEvent, { type: "preview" }>).url!;
	assert.match(await (await fetch(url)).text(), /Hello from the example page/);

	await session.dispose();
	await assert.rejects(fetch(url));
});

test("Claude subscription OAuth is never offered nor accepted", async () => {
	const modelRuntime = await runtimeWithAuth({
		anthropic: { type: "oauth", access: "sk-ant-oat01-test", refresh: "r", expires: FAR_FUTURE },
		openai: { type: "api_key", key: "sk-test" },
	});

	const usable = await listUsableModels(modelRuntime);
	assert.ok(usable.some((m) => m.provider === "openai"));
	assert.ok(!usable.some((m) => m.provider === "anthropic"));

	const dir = await mkdtemp(join(tmpdir(), "s-ui-empty-"));
	const claude = modelRuntime.getModels("anthropic")[0]!;
	await assert.rejects(ProjectSession.open({ dir, modelRuntime, model: claude }), /OAuth/);
});
