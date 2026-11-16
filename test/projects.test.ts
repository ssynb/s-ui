import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectFolder, listFolder, RecentProjects } from "../server/projects.ts";

const tempDir = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

test("recent projects survive a restart, most recent first, without duplicates or deleted folders", async () => {
	const file = join(await tempDir("s-ui-config-"), "config.json");
	const [a, b, gone] = await Promise.all([tempDir("s-ui-a-"), tempDir("s-ui-b-"), tempDir("s-ui-gone-")]);
	const recents = await RecentProjects.load(file);
	await recents.add(a);
	await recents.add(gone);
	await recents.add(b);
	await recents.add(a);
	await import("node:fs/promises").then((fs) => fs.rm(gone, { recursive: true }));

	const reloaded = await RecentProjects.load(file);
	assert.deepEqual(await reloaded.list(), [a, b]);
});

test("folder listing shows subfolders, marks front-end projects, hides dot folders and node_modules", async () => {
	const root = await tempDir("s-ui-list-");
	await mkdir(join(root, "site"));
	await writeFile(join(root, "site", "package.json"), "{}");
	await mkdir(join(root, "Notes"));
	await mkdir(join(root, ".git"));
	await mkdir(join(root, "node_modules"));
	await writeFile(join(root, "readme.txt"), "");

	const listing = await listFolder(root);
	assert.equal(listing.path, root);
	assert.deepEqual(
		listing.entries.map((e) => [e.name, e.isProject]),
		[
			["Notes", false],
			["site", true],
		],
	);
	await assert.rejects(listFolder(join(root, "missing")));
});

test("a new project is a fresh folder inside the chosen parent; existing folders and nested names are refused", async () => {
	const parent = await tempDir("s-ui-new-");
	const created = await createProjectFolder(parent, "coffee-shop");
	assert.equal(created, join(parent, "coffee-shop"));
	assert.deepEqual((await listFolder(parent)).entries.map((e) => e.name), ["coffee-shop"]);

	await assert.rejects(createProjectFolder(parent, "coffee-shop"));
	await assert.rejects(createProjectFolder(parent, "../escape"));
	await assert.rejects(createProjectFolder(parent, ""));
});
