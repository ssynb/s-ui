// 记账式写文件：给 AI 用的 edit/write 工具都经这里写盘，记下每个文件被第一次改之前的内容和 AI 最后写入的内容。
// AI 每次写之前都核对：它写过的文件此刻必须仍是它上次写入的内容，否则说明别人改过，拒绝覆盖并把这个文件交还给别人；
// 撤销时只动 AI 写过、且此刻仍是 AI 写入内容的文件，期间别人（编辑器、其他程序）的改动原样保留并报告。
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
	/** AI 写过、之后被别人改过的文件：不再归 AI，撤销时不动。 */
	#conflicts = new Set<string>();

	constructor(root: string) {
		this.#root = resolve(root);
	}

	/** 目录可以是项目根本身或其下的目录；文件必须在项目根之下。 */
	#inside(path: string, kind: "file" | "dir" = "file") {
		const target = resolve(this.#root, path);
		const rel = relative(this.#root, target);
		if (rel.startsWith("..") || isAbsolute(rel) || (!rel && kind === "file")) throw new Error(`Writing outside the project is not allowed: ${path}`);
		return target;
	}

	async #current(target: string) {
		return existsSync(target) ? readFile(target, "utf8") : undefined;
	}

	async #write(path: string, content: string) {
		const target = this.#inside(path);
		const relPath = relative(this.#root, target);
		if (this.#conflicts.has(target)) throw new Error(`${relPath} was changed by someone else during organizing; leave it as it is`);
		if (this.#written.has(target) && (await this.#current(target)) !== this.#written.get(target)) {
			this.#conflicts.add(target);
			throw new Error(`${relPath} was changed by someone else during organizing; leave it as it is`);
		}
		if (!this.#originals.has(target)) this.#originals.set(target, existsSync(target) ? await readFile(target) : null);
		await writeFile(target, content);
		this.#written.set(target, content);
	}

	/** 只能在项目内写、且写入都被记账的 edit / write 工具（替换同名内置工具）。 */
	tools(): ToolDefinition[] {
		const write = (path: string, content: string) => this.#write(path, content);
		// 具体工具的参数类型与 customTools 的通用类型不协变，这里收窄为通用类型。
		return [
			createWriteToolDefinition(this.#root, { operations: { writeFile: write, mkdir: async (dir) => void (await mkdir(this.#inside(dir, "dir"), { recursive: true })) } }),
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
			if (this.#conflicts.has(path)) continue;
			if ((await this.#current(path)) === content && !this.#originals.get(path)?.equals(Buffer.from(content))) changed.push(relative(this.#root, path));
		}
		return changed.sort();
	}

	/** 撤销 AI 的写入；返回因已被别人改过而保留未动的文件（相对项目根）。 */
	async undo() {
		const kept: string[] = [];
		for (const [path, content] of this.#written) {
			if (this.#conflicts.has(path) || (await this.#current(path)) !== content) {
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
