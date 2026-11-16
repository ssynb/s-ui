import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { FolderListing } from "./protocol.ts";

const MAX_RECENT = 20;
const HIDDEN_FOLDERS = new Set(["node_modules"]);

/** 最近打开的项目，最新的在前，持久化在 s-ui 的配置文件里。 */
export class RecentProjects {
	readonly #file: string;
	#paths: string[];
	#writing: Promise<void> = Promise.resolve();

	private constructor(file: string, paths: string[]) {
		this.#file = file;
		this.#paths = paths;
	}

	static async load(file: string) {
		if (!existsSync(file)) return new RecentProjects(file, []);
		const config = JSON.parse(await readFile(file, "utf8"));
		return new RecentProjects(file, config.recentProjects ?? []);
	}

	/** 仍然存在的最近项目；已删除的文件夹不列出，但留在记录里。 */
	async list() {
		return this.#paths.filter((p) => existsSync(p));
	}

	add(path: string) {
		this.#paths = [path, ...this.#paths.filter((p) => p !== path)].slice(0, MAX_RECENT);
		const snapshot = JSON.stringify({ recentProjects: this.#paths }, null, 2);
		// 串行写，后发起的写入总在前一个之后落盘。
		this.#writing = this.#writing.then(async () => {
			await mkdir(dirname(this.#file), { recursive: true });
			await writeFile(this.#file, snapshot);
		});
		return this.#writing;
	}
}

/** 列出一个文件夹下的子文件夹，标出其中的前端项目（含 package.json）。 */
export async function listFolder(path: string): Promise<FolderListing> {
	const dirents = await readdir(path, { withFileTypes: true });
	const entries = dirents
		.filter((d) => d.isDirectory() && !d.name.startsWith(".") && !HIDDEN_FOLDERS.has(d.name))
		.map((d) => ({ name: d.name, path: join(path, d.name), isProject: existsSync(join(path, d.name, "package.json")) }))
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
	const parent = dirname(path);
	return { path, parent: parent === path ? null : parent, entries };
}

/** 在父文件夹里新建一个空项目文件夹；名字必须是单层文件夹名，且不能已存在。 */
export async function createProjectFolder(parent: string, name: string) {
	const trimmed = name.trim();
	if (!trimmed || basename(trimmed) !== trimmed || trimmed === "." || trimmed === "..") throw Object.assign(new Error(`Invalid project name: ${name}`), { code: "EINVAL" });
	const path = join(parent, trimmed);
	await mkdir(path);
	return path;
}
