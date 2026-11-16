import { glob, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type ElementHints = { id: string; classes: string[]; ownText: string };

const SOURCE_GLOB = "**/*.{html,js,jsx,ts,tsx,vue,svelte,astro,mdx}";
const IGNORED = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.*/**"];
const MAX_FILE_BYTES = 256 * 1024;
const MAX_RESULTS = 3;
const TEXT_PROBE_CHARS = 40;

function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineScorer({ id, classes, ownText }: ElementHints) {
	const idPattern = id ? new RegExp(`\\bid\\s*=\\s*[{"']*${escapeRegExp(id)}\\b`) : undefined;
	const text = ownText.slice(0, TEXT_PROBE_CHARS);
	const classProbe = classes.slice(0, 3);
	return (line: string) =>
		(idPattern?.test(line) ? 3 : 0) +
		(text.length >= 2 && line.includes(text) ? 2 : 0) +
		(classProbe.length && classProbe.every((c) => line.includes(c)) ? 1 : 0);
}

/** 按 id、文本和 class 在项目源码里猜元素的出处，返回 "相对路径:行号"，最可信的在前。 */
export async function locateInSource(projectDir: string, hints: ElementHints): Promise<string[]> {
	const score = lineScorer(hints);
	const matches: { where: string; score: number }[] = [];
	for await (const file of glob(SOURCE_GLOB, { cwd: projectDir, exclude: IGNORED })) {
		const path = join(projectDir, file);
		if ((await stat(path)).size > MAX_FILE_BYTES) continue;
		(await readFile(path, "utf8")).split("\n").forEach((line, i) => {
			const s = score(line);
			if (s > 0) matches.push({ where: `${file}:${i + 1}`, score: s });
		});
	}
	return matches
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_RESULTS)
		.map((m) => m.where);
}
