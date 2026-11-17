import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESIGN_TOKENS, TOKENS_FILE } from "../server/design-tokens.ts";
import { saveTokens } from "../server/tokens-file.ts";

const FILE = `:root {\n${DESIGN_TOKENS.map((t) => `  ${t.name}: 0;`).join("\n")}\n}\n.after { color: blue; }\n`;

test("values that would open a comment, an unclosed string or bracket are refused; ordinary CSS values are written", async () => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-values-"));
	await mkdir(join(dir, "src"));
	await writeFile(join(dir, TOKENS_FILE), FILE);

	for (const bad of ["red/*", "red */", '"Inter', "rgb(1, 2, 3", "red)", "a\\9", "url(x) }"]) {
		await assert.rejects(saveTokens(dir, { "--sui-color-primary": bad }), Error, bad);
	}
	assert.equal(await readFile(join(dir, TOKENS_FILE), "utf8"), FILE);

	const good = { "--sui-font-heading": '"Noto Serif SC", serif', "--sui-shadow-md": "0 4px 12px rgba(0, 0, 0, 0.12)", "--sui-color-primary": "#e11d48" };
	const status = await saveTokens(dir, good);
	assert.deepEqual({ ...status.values }, { ...status.values, ...good });
	assert.match(await readFile(join(dir, TOKENS_FILE), "utf8"), /\.after \{ color: blue; \}/);
});
