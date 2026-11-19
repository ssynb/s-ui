#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_MODEL, listUsableModels, modelKey } from "./models.ts";
import { APP_HOME } from "./app-home.ts";
import { dispatchModule, MODULES } from "./modules.ts";
import { discoverProjects } from "./project-discovery.ts";
import { ProjectSession } from "./project-session.ts";
import { commonPlaces, createProjectFolder, listFolder, prepareExample, RecentProjects } from "./projects.ts";
import type { ClientMessage, ExclusiveTask, ServerMessage } from "./protocol.ts";

const WEB_ROOT = fileURLToPath(new URL("../web", import.meta.url));
const EXAMPLE_SOURCE = fileURLToPath(new URL("../examples/hello-page", import.meta.url));

const { values: flags } = parseArgs({
	options: { port: { type: "string", default: "5180" }, "no-open": { type: "boolean", default: false } },
});

const modelRuntime = await ModelRuntime.create();
const recentProjects = await RecentProjects.load(join(APP_HOME, "config.json"));
// “打开示例项目”打开的是 s-ui 目录里的副本，不是仓库里被跟踪的示例。
const EXAMPLE_DIR = await prepareExample(EXAMPLE_SOURCE, APP_HOME);
const HOME = homedir();
const PLACES = commonPlaces(HOME);
type OpenedSession = { id: string; session: ProjectSession };
// 每个文件夹只有一个会话；存 Promise 让并发的 open 共享同一次创建。
const sessionsByDir = new Map<string, Promise<OpenedSession>>();
const sessionsById = new Map<string, ProjectSession>();
// 只有工作台自己的页面能连 WebSocket：它能改本机代码、执行命令，回环地址挡不住浏览器里的其他网站。
let appOrigins: string[] = [];

function expandDir(dir: string) {
	return resolve(dir.trim().replace(/^~(?=$|[\\/])/, HOME));
}

function assertFolder(dir: string) {
	if (!existsSync(dir) || !statSync(dir).isDirectory()) throw Object.assign(new Error(`Folder not found: ${dir}`), { code: "ENOENT" });
}

function broadcast(msg: ServerMessage) {
	for (const client of wss.clients) client.send(JSON.stringify(msg));
}

async function usableModel(modelId: string) {
	const model = (await listUsableModels(modelRuntime)).find((m) => modelKey(m) === modelId);
	if (!model) throw new Error(`Model not available: ${modelId}`);
	return model;
}

async function createSession(dir: string, modelId: string): Promise<OpenedSession> {
	const model = await usableModel(modelId);
	const opened = { id: randomUUID(), session: await ProjectSession.open({ dir, modelRuntime, model, appOrigins }) };
	sessionsById.set(opened.id, opened.session);
	return opened;
}

function openSession(dir: string, modelId: string) {
	let opened = sessionsByDir.get(dir);
	if (!opened) {
		opened = createSession(dir, modelId);
		sessionsByDir.set(dir, opened);
		opened.catch(() => sessionsByDir.delete(dir));
	}
	return opened;
}

function connect(ws: WebSocket) {
	const send = (msg: ServerMessage) => ws.send(JSON.stringify(msg));
	// 每个会话在一条连接上只订阅一次；重新打开时换新订阅，以便重放当前预览状态。
	const subscriptions = new Map<string, () => void>();
	ws.on("close", () => subscriptions.forEach((off) => off()));

	const open = async (requestId: string, dir: string, model: string) => {
		const { id: sessionId, session } = await openSession(dir, model);
		subscriptions.get(sessionId)?.();
		send({ type: "opened", requestId, sessionId, dir, model: modelKey(session.model) });
		subscriptions.set(sessionId, session.subscribe((event) => send({ type: "event", sessionId, event })));
		await recentProjects.add(dir);
		broadcast({ type: "recentProjects", projects: await recentProjects.list() });
	};

	const handle = async (msg: ClientMessage) => {
		if (msg.type === "open") {
			const dir = expandDir(msg.dir);
			assertFolder(dir);
			const candidates = await discoverProjects(dir);
			if (candidates.length > 1) return send({ type: "projectChoices", requestId: msg.requestId, directories: candidates });
			return open(msg.requestId, candidates[0] ?? dir, msg.model);
		}
		if (msg.type === "createProject") return open(msg.requestId, await createProjectFolder(expandDir(msg.parent), msg.name), msg.model);
		if (msg.type === "listFolder") return send({ type: "folder", requestId: msg.requestId, listing: await listFolder(expandDir(msg.path)) });
		if (msg.type === "module") {
			const session = msg.sessionId ? sessionsById.get(msg.sessionId) : undefined;
			const ctx = {
				modelRuntime,
				project: session && {
					dir: session.dir,
					model: session.model,
					previewUrl: session.previewUrl,
					exclusive: <T>(task: ExclusiveTask, fn: () => Promise<T>) => session.runExclusive(task, fn),
				},
				progress: (data: unknown) => send({ type: "moduleProgress", requestId: msg.requestId, data }),
			};
			return send({ type: "moduleResult", requestId: msg.requestId, result: await dispatchModule(MODULES, msg, ctx) });
		}
		const session = sessionsById.get(msg.sessionId);
		if (!session) throw new Error(`Unknown session: ${msg.sessionId}`);
		if (msg.type === "selectPage" || msg.type === "capturePage") {
			const result = msg.type === "selectPage" ? session.selectPage(msg.path) : await session.capturePage(msg.path);
			return send({ type: "moduleResult", requestId: msg.requestId, result });
		}
		if (msg.type === "prompt") return session.prompt(msg.text, { annotation: msg.annotation, annotations: msg.annotations, images: msg.images });
		if (msg.type === "abort") return session.abort();
		if (msg.type === "setModel") return session.setModel(await usableModel(msg.model));
		if (msg.type === "newConversation") return session.newConversation();
		if (msg.type === "switchConversation") return session.switchConversation(msg.conversationId);
	};
	ws.on("message", (data) => {
		let requestId: string | undefined;
		const run = async () => {
			const msg = JSON.parse(data.toString()) as ClientMessage;
			requestId = "requestId" in msg ? msg.requestId : undefined;
			await handle(msg);
		};
		run().catch((error: NodeJS.ErrnoException) => send({ type: "error", requestId, code: error.code, message: error.message }));
	});

	Promise.all([listUsableModels(modelRuntime), recentProjects.list()]).then(([models, recents]) => {
		const ids = models.map(modelKey);
		send({
			type: "hello",
			models: ids.map((id) => ({ id, label: id })),
			defaultModel: ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : ids[0],
			exampleDir: EXAMPLE_DIR,
			home: HOME,
			places: PLACES,
			recentProjects: recents,
		});
	});
}

function openBrowser(url: string) {
	const [cmd, ...args] =
		process.platform === "darwin" ? ["open", url] : process.platform === "win32" ? ["cmd", "/c", "start", "", url] : ["xdg-open", url];
	spawn(cmd!, args, { stdio: "ignore", detached: true }).unref();
}

const httpServer = createServer();
const vite = await createViteServer({
	root: WEB_ROOT,
	cacheDir: join(APP_HOME, "vite"),
	configFile: false,
	plugins: [react(), tailwindcss()],
	appType: "spa",
	server: { middlewareMode: true, hmr: { server: httpServer } },
});
httpServer.on("request", vite.middlewares);

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", connect);
httpServer.on("upgrade", (req, socket, head) => {
	if (req.url !== "/ws") return;
	if (!appOrigins.includes(req.headers.origin ?? "")) {
		socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
		return;
	}
	wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

async function shutdown() {
	await Promise.all([...sessionsById.values()].map((s) => s.dispose()));
	await vite.close();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.listen(Number(flags.port), "127.0.0.1", () => {
	const { port } = httpServer.address() as AddressInfo;
	appOrigins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
	const url = `${appOrigins[0]}/`;
	console.log(`s-ui running at ${url}`);
	if (!flags["no-open"]) openBrowser(url);
});
