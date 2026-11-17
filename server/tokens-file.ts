// 设计变量文件的读取与确定性改写：只动给出的变量值和顶部的字体 @import 行，其余文字原样保留。
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DESIGN_TOKENS, type TokenName, TOKENS_FILE, type TokenValues } from "./design-tokens.ts";
import type { PolishStatus } from "./modules/polish.ts";

const TOKEN_NAMES = new Set<string>(DESIGN_TOKENS.map((t) => t.name));
const IMPORT_LINE = /^\s*@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;?\s*$/;
// 值只能是一条声明的值：不能带 ; { } 或换行，否则会改出文件里别的规则。
const SAFE_VALUE = /^[^;{}<>\n\r]{1,200}$/;
const SAFE_IMPORT = /^https:\/\/[^\s"'()]+$/;

function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declaration(name: string) {
	return new RegExp(`(${escapeRegExp(name)}\\s*:\\s*)([^;]+?)(\\s*;)`);
}

function parse(text: string) {
	const values: TokenValues = {};
	for (const { name } of DESIGN_TOKENS) {
		const match = text.match(declaration(name));
		if (match) values[name] = match[2]!.trim();
	}
	const fontImports = text.split("\n").flatMap((line) => line.match(IMPORT_LINE)?.[1] ?? []);
	return { values, fontImports };
}

export async function readTokensStatus(dir: string): Promise<PolishStatus> {
	const path = join(dir, TOKENS_FILE);
	const text = existsSync(path) ? await readFile(path, "utf8") : "";
	const { values, fontImports } = parse(text);
	const missing = DESIGN_TOKENS.map((t) => t.name).filter((name) => !(name in values)) as TokenName[];
	return { organized: Boolean(text) && missing.length === 0, file: TOKENS_FILE, values, missing, fontImports };
}

function replaceImports(text: string, imports: string[]) {
	const lines = text.split("\n");
	const isImport = (line: string) => IMPORT_LINE.test(line);
	const first = lines.findIndex(isImport);
	const fresh = imports.map((url) => `@import url("${url}");`);
	if (first === -1) return fresh.length ? [...fresh, "", ...lines].join("\n") : text;
	return [...lines.slice(0, first), ...fresh, ...lines.slice(first).filter((line) => !isImport(line))].join("\n");
}

/** 写回变量值与字体 @import；未整理（文件缺变量）时失败，非法值整体拒绝、文件不动。 */
export async function saveTokens(dir: string, values: TokenValues, fontImports?: string[]) {
	const status = await readTokensStatus(dir);
	if (!status.organized) throw new Error(`Design tokens are not organized yet (${TOKENS_FILE})`);
	for (const [name, value] of Object.entries(values)) {
		if (!TOKEN_NAMES.has(name)) throw new Error(`Unknown design token: ${name}`);
		if (!SAFE_VALUE.test(value!)) throw new Error(`Invalid value for ${name}`);
	}
	for (const url of fontImports ?? []) {
		if (!SAFE_IMPORT.test(url)) throw new Error(`Font imports must be https URLs: ${url}`);
	}

	const path = join(dir, TOKENS_FILE);
	let text = await readFile(path, "utf8");
	for (const [name, value] of Object.entries(values)) {
		text = text.replace(declaration(name), (_m, head: string, _old: string, tail: string) => `${head}${value!.trim()}${tail}`);
	}
	if (fontImports) text = replaceImports(text, fontImports);
	await writeFile(path, text);
	return readTokensStatus(dir);
}
