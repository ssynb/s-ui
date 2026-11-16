import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+[^\s]*/;
const LOG_TAIL_LINES = 30;

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const LOCKFILES: [string, PackageManager][] = [
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
];

function packageManager(dir: string): PackageManager {
	return LOCKFILES.find(([file]) => existsSync(join(dir, file)))?.[1] ?? "npm";
}

export async function hasDevScript(dir: string) {
	try {
		const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
		return typeof pkg.scripts?.dev === "string";
	} catch {
		return false;
	}
}

function spawnIn(dir: string, cmd: string, args: string[]) {
	// detached：独立进程组，stop 时能连同 dev server 的子进程一起结束。
	return spawn(cmd, args, {
		cwd: dir,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, BROWSER: "none", NO_COLOR: "1", FORCE_COLOR: "0" },
	});
}

function collectLog(child: ChildProcess, onLine: (line: string) => void) {
	const tail: string[] = [];
	const feed = (chunk: Buffer) => {
		for (const raw of chunk.toString().split(/\r?\n/)) {
			const line = stripVTControlCharacters(raw).trim();
			if (!line) continue;
			tail.push(line);
			if (tail.length > LOG_TAIL_LINES) tail.shift();
			onLine(line);
		}
	};
	child.stdout!.on("data", feed);
	child.stderr!.on("data", feed);
	return () => tail.join("\n");
}

function failure(what: string, log: string) {
	return new Error(`${what}\n${log}`);
}

/** 一个项目的 dev server 进程：按需安装依赖、启动、从输出里识别本地地址、停止。 */
export class DevServer {
	readonly dir: string;
	#child?: ChildProcess;
	#exited?: Promise<void>;

	constructor(dir: string) {
		this.dir = dir;
	}

	async install() {
		const child = spawnIn(this.dir, packageManager(this.dir), ["install"]);
		const log = collectLog(child, () => {});
		const code = await new Promise<number | null>((resolve, reject) => {
			child.on("error", reject);
			child.on("close", resolve);
		});
		if (code !== 0) throw failure(`install exited with ${code}`, log());
	}

	needsInstall() {
		return !existsSync(join(this.dir, "node_modules"));
	}

	/** 启动 dev script，解析出本地预览地址；进程在给出地址前退出则失败。 */
	start(onExit: (log: string) => void) {
		const child = spawnIn(this.dir, packageManager(this.dir), ["run", "dev"]);
		this.#child = child;
		this.#exited = new Promise((resolve) => child.on("close", () => resolve()));
		return new Promise<string>((resolve, reject) => {
			child.on("error", (error) => {
				if (this.#child === child) this.#child = undefined;
				reject(error);
			});
			let url: string | undefined;
			const log = collectLog(child, (line) => {
				const found = url ? undefined : line.match(LOCAL_URL)?.[0];
				if (!found) return;
				url = found;
				resolve(found);
			});
			child.on("close", (code) => {
				const stoppedByUs = this.#child !== child;
				if (!stoppedByUs) this.#child = undefined;
				if (!url) return reject(failure(`dev server exited with ${code}`, log()));
				if (!stoppedByUs) onExit(log());
			});
		});
	}

	async stop() {
		const child = this.#child;
		if (!child?.pid) return;
		this.#child = undefined;
		process.kill(-child.pid, "SIGTERM");
		await this.#exited;
	}
}
