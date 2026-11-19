import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasDevScript } from "./dev-server.ts";

const DEPENDENCY_DIRS = new Set(["node_modules", "vendor", "bower_components"]);

/** 本层优先；只看直接子目录，不进入依赖、隐藏目录或符号链接。 */
export async function discoverProjects(dir: string) {
	if (await hasDevScript(dir)) return [dir];
	const entries = await readdir(dir, { withFileTypes: true });
	const candidates = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && !DEPENDENCY_DIRS.has(e.name));
	const found = await Promise.all(candidates.map(async (e) => {
		const path = join(dir, e.name);
		return await hasDevScript(path) ? path : undefined;
	}));
	return found.filter((path): path is string => Boolean(path)).sort();
}

async function entriesIfPresent(dir: string) {
	try {
		return await readdir(dir, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

/** Next App Router 的静态 URL；route groups 不占 URL 段，动态/私有/并行/拦截路由不作为独立页面。 */
export async function discoverPages(dir: string): Promise<string[]> {
	const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
	if (!pkg.dependencies?.next && !pkg.devDependencies?.next) return [];
	const app = await entriesIfPresent(join(dir, "app")) ? join(dir, "app") : join(dir, "src/app");
	const paths = new Set<string>();
	async function walk(folder: string, segments: string[]) {
		const entries = await entriesIfPresent(folder);
		if (!entries) return;
		if (entries.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name))) paths.add(`/${segments.join("/")}`);
		await Promise.all(entries.filter((e) => e.isDirectory()).map(async (e) => {
			if (/^[_.@]|\[|\]|^\(\./.test(e.name)) return;
			const group = /^\([^()]+\)$/.test(e.name);
			await walk(join(folder, e.name), group ? segments : [...segments, encodeURIComponent(e.name)]);
		}));
	}
	await walk(app, []);
	return [...paths].sort();
}
