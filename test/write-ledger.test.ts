import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WriteLedger } from "../server/write-ledger.ts";

async function setup() {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-ledger-"));
	const ledger = new WriteLedger(dir);
	const [write] = ledger.tools();
	const aiWrite = (path: string, content: string) => write!.execute("call", { path, content }, undefined, undefined, undefined as never);
	return { dir, ledger, aiWrite };
}

test("the AI can write files at the project root, but not outside the project", async () => {
	const { dir, aiWrite } = await setup();
	await aiWrite("root-file.css", "a {}");
	assert.equal(await readFile(join(dir, "root-file.css"), "utf8"), "a {}");
	await assert.rejects(aiWrite("../escaped.css", "a {}"));
	assert.equal(existsSync(join(dir, "..", "escaped.css")), false);
});

test("once someone else edits a file the AI wrote, the AI may not overwrite it and undo keeps their edit", async () => {
	const { dir, ledger, aiWrite } = await setup();
	await writeFile(join(dir, "style.css"), "original");
	await aiWrite("style.css", "ai first");
	await writeFile(join(dir, "style.css"), "user edit");

	await assert.rejects(aiWrite("style.css", "ai second"), /changed/i);
	assert.equal(await readFile(join(dir, "style.css"), "utf8"), "user edit");
	assert.deepEqual(await ledger.undo(), ["style.css"]);
	assert.equal(await readFile(join(dir, "style.css"), "utf8"), "user edit");
	assert.deepEqual(await ledger.changedFiles(), []);
});
