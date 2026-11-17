// 记账式写文件：给 AI 用的 edit/write 工具都经这里写盘，记下每个文件被第一次改之前的内容和 AI 最后写入的内容。
// 撤销时只动 AI 写过、且此刻仍是 AI 写入内容的文件，期间别人（编辑器、其他程序）的改动原样保留。
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { createEditToolDefinition, createWriteToolDefinition, type ToolDefinition } from "@earendil-works/pi-coding-agent";

export class WriteLedger {
	readonly #root: string;
	/** 绝对路径 → AI 第一次写之前的内容；null 表示原本不存在。 */
	#originals = new Map<string, Buffer | null>();
	/** 绝对路径 → AI 最后写入的内容。 */
	#written = new Map<string, string>();

	constructor(root: string) {
		this.#root = resolve(root);
	}

	#inside(path: string) {
		const rel = relative(this.#root, resolve(path));
		if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Writing outside the project is not allowed: ${path}`);
		return resolve(path);
	}

	async #write(path: string, content: string) {
		const target = this.#inside(path);
		if (!this.#originals.has(target)) this.#originals.set(target, existsSync(target) ? await readFile(target) : null);
		await writeFile(target, content);
		this.#written.set(target, content);
	}

	/** 只能在项目内写、且写入都被记账的 edit / write 工具（替换同名内置工具）。 */
	tools(): ToolDefinition[] {
		const write = (path: string, content: string) => this.#write(path, content);
		// 具体工具的参数类型与 customTools 的通用类型不协变，这里收窄为通用类型。
		return [
			createWriteToolDefinition(this.#root, { operations: { writeFile: write, mkdir: async (dir) => void (await mkdir(this.#inside(dir), { recursive: true })) } }),
			createEditToolDefinition(this.#root, {
				operations: {
					readFile: (path) => readFile(this.#inside(path)),
					access: async (path) => void (await readFile(this.#inside(path))),
					writeFile: write,
				},
			}),
		] as ToolDefinition[];
	}

	/** 此刻仍是 AI 写入内容、且与原内容不同的文件（相对项目根）：即项目里现存的 AI 改动。 */
	async changedFiles() {
		const changed: string[] = [];
		for (const [path, content] of this.#written) {
			const current = existsSync(path) ? await readFile(path, "utf8") : undefined;
			if (current === content && !this.#originals.get(path)?.equals(Buffer.from(content))) changed.push(relative(this.#root, path));
		}
		return changed.sort();
	}

	/** 撤销 AI 的写入；返回因已被别人改过而保留未动的文件（相对项目根）。 */
	async undo() {
		const kept: string[] = [];
		for (const [path, content] of this.#written) {
			const current = existsSync(path) ? await readFile(path, "utf8") : undefined;
			if (current !== content) {
				kept.push(relative(this.#root, path));
				continue;
			}
			const original = this.#originals.get(path);
			if (original) await writeFile(path, original);
			else await rm(path, { force: true });
		}
		return kept.sort();
	}
}
