import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DevServer } from "../server/dev-server.ts";

test("a missing package manager fails install and start as errors instead of crashing", async () => {
	const dev = new DevServer(await mkdtemp(join(tmpdir(), "s-ui-nopm-")));
	const path = process.env.PATH;
	process.env.PATH = "";
	try {
		await assert.rejects(dev.install(), /ENOENT/);
		await assert.rejects(dev.start(() => {}), /ENOENT/);
	} finally {
		process.env.PATH = path;
	}
});
