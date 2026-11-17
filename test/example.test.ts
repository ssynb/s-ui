import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareExample } from "../server/projects.ts";

test("the example is opened from a copy in s-ui's own folder, made once and then reused, so the source is never edited", async () => {
	const source = await mkdtemp(join(tmpdir(), "s-ui-example-src-"));
	await mkdir(join(source, "node_modules", "vite"), { recursive: true });
	await writeFile(join(source, "index.html"), "<h1>original</h1>");
	const appHome = await mkdtemp(join(tmpdir(), "s-ui-home-"));

	const copy = await prepareExample(source, appHome);
	assert.ok(copy.startsWith(appHome));
	assert.equal(await readFile(join(copy, "index.html"), "utf8"), "<h1>original</h1>");
	assert.equal(existsSync(join(copy, "node_modules")), false);

	await writeFile(join(copy, "index.html"), "<h1>edited by the AI</h1>");
	assert.equal(await prepareExample(source, appHome), copy);
	assert.equal(await readFile(join(copy, "index.html"), "utf8"), "<h1>edited by the AI</h1>");
	assert.equal(await readFile(join(source, "index.html"), "utf8"), "<h1>original</h1>");
});
