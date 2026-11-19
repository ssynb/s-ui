import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESIGN_TOKENS, TOKENS_FILE } from "../server/design-tokens.ts";
import { dispatchModule, MODULES, type ModuleContext } from "../server/modules.ts";

const ORGANIZED = `@import url("https://fonts.googleapis.com/css2?family=Lora");

/* brand tokens */
:root {
${DESIGN_TOKENS.filter(t => t.name !== "--sui-font-ui").map((t) => `  ${t.name}: ${t.name === "--sui-color-primary" ? "#3574f0" : t.name === "--sui-radius-md" ? "6px" : "initial"};`).join("\n")}
}

.button { background: var(--sui-color-primary); }
`;

async function project(tokens?: string) {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-polish-"));
	if (tokens !== undefined) {
		await mkdir(join(dir, "src"));
		await writeFile(join(dir, TOKENS_FILE), tokens);
	}
	const exclusive = <T>(_task: string, fn: () => Promise<T>) => fn();
	const ctx = { project: { dir, exclusive }, progress: () => {} } as unknown as ModuleContext;
	const call = (action: string, payload: unknown = {}) => dispatchModule(MODULES, { module: "polish", action, payload }, ctx) as Promise<any>;
	return { dir, call };
}

test("a project without design tokens is reported as not organized, and saving tokens is refused", async () => {
	const { call } = await project();
	const status = await call("status");
	assert.equal(status.organized, false);
	assert.equal(status.file, TOKENS_FILE);
	assert.deepEqual(status.missing, DESIGN_TOKENS.filter(t => t.name !== "--sui-font-ui").map((t) => t.name));
	await assert.rejects(call("saveTokens", { values: { "--sui-color-primary": "#ff0000" } }));
});

test("saving tokens rewrites only the given values and the font imports, leaving the rest of the file as it was", async () => {
	const { dir, call } = await project(ORGANIZED);
	const before = await call("status");
	assert.equal(before.organized, true, "legacy projects need no reorganization");
 assert.equal(before.values["--sui-font-ui"], undefined);
	assert.equal(before.values["--sui-color-primary"], "#3574f0");
	assert.deepEqual(before.fontImports, ["https://fonts.googleapis.com/css2?family=Lora"]);

	const after = await call("saveTokens", {
		values: { "--sui-color-primary": "#e11d48", "--sui-radius-md": "14px" },
		fontImports: ["https://fonts.googleapis.com/css2?family=Inter"],
	});
	assert.equal(after.values["--sui-color-primary"], "#e11d48");
	assert.equal(after.values["--sui-radius-md"], "14px");
	assert.deepEqual(after.fontImports, ["https://fonts.googleapis.com/css2?family=Inter"]);

	const text = await readFile(join(dir, TOKENS_FILE), "utf8");
	const expected = ORGANIZED.replace("#3574f0", "#e11d48").replace("--sui-radius-md: 6px", "--sui-radius-md: 14px").replace("family=Lora", "family=Inter");
	assert.equal(text, expected);
});

test("values that would break out of the declaration and non-https font imports are refused", async () => {
	const { dir, call } = await project(ORGANIZED);
	await assert.rejects(call("saveTokens", { values: { "--sui-color-primary": "red; } body { display: none" } }));
	await assert.rejects(call("saveTokens", { values: {}, fontImports: ["javascript:alert(1)"] }));
	assert.equal(await readFile(join(dir, TOKENS_FILE), "utf8"), ORGANIZED);
});
