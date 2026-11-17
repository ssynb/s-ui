import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESIGN_TOKENS, TOKENS_FILE } from "../server/design-tokens.ts";
import { saveTokens } from "../server/tokens-file.ts";

const FILE = `:root {\n${DESIGN_TOKENS.map((t) => `  ${t.name}: 0;`).join("\n")}\n}\n.after { color: blue; }\n`;

test("any unbalanced or mismatched bracket is refused and leaves the file untouched; properly nested brackets are fine", async () => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-brackets-"));
	await mkdir(join(dir, "src"));
	await writeFile(join(dir, TOKENS_FILE), FILE);

	for (const bad of ["red[", "red]", "a(]", "a[)", "f([)]", "x(y[z)]"]) {
		await assert.rejects(saveTokens(dir, { "--sui-color-primary": bad }), Error, bad);
	}
	assert.equal(await readFile(join(dir, TOKENS_FILE), "utf8"), FILE);

	const status = await saveTokens(dir, { "--sui-color-primary": "color-mix(in srgb, var(--a) 50%, #fff)", "--sui-space": "[full] 8px" });
	assert.equal(status.values["--sui-space"], "[full] 8px");
});
