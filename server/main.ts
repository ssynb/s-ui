#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_MODEL, listUsableModels, modelKey } from "./models.ts";
import { ProjectSession } from "./project-session.ts";
import type { ClientMessage, ServerMessage } from "./protocol.ts";

const WEB_ROOT = new URL("../web", import.meta.url).pathname;
const EXAMPLE_DIR = new URL("../examples/hello-page", import.meta.url).pathname;

const { values: flags } = parseArgs({
	options: { port: { type: "string", default: "5180" }, "no-open": { type: "boolean", default: false } },
});

const modelRuntime = await ModelRuntime.create();
type OpenedSession = { id: string; session: ProjectSession };
// 每个文件夹只有一个会话；存 Promise 让并发的 open 共享同一次创建。
const sessionsByDir = new Map<string, Promise<OpenedSession>>();
const sessionsById = new Map<string, ProjectSession>();

function expandDir(dir: string) {
	return resolve(dir.trim().replace(/^~(?=$|\/)/, homedir()));
}

async function createSession(dir: string, modelId: string): Promise<OpenedSession> {
	const model = (await listUsableModels(modelRuntime)).find((m) => modelKey(m) === modelId);
	if (!model) throw new Error(`Model not available: ${modelId}`);
	const opened = { id: randomUUID(), session: await ProjectSession.open({ dir, modelRuntime, model }) };
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
	const unsubscribers: (() => void)[] = [];
	ws.on("close", () => unsubscribers.forEach((off) => off()));

	const handle = async (msg: ClientMessage) => {
		if (msg.type === "open") {
			const dir = expandDir(msg.dir);
			const { id: sessionId, session } = await openSession(dir, msg.model);
			send({ type: "opened", sessionId, dir });
			unsubscribers.push(session.subscribe((event) => send({ type: "event", sessionId, event })));
			return;
		}
		const session = sessionsById.get(msg.sessionId);
		if (!session) throw new Error(`Unknown session: ${msg.sessionId}`);
		if (msg.type === "prompt") return session.prompt(msg.text, msg.annotation);
		if (msg.type === "abort") return session.abort();
	};
	ws.on("message", (data) => {
		handle(JSON.parse(data.toString())).catch((error: Error) => send({ type: "error", message: error.message }));
	});

	listUsableModels(modelRuntime).then((models) => {
		const ids = models.map(modelKey);
		send({
			type: "hello",
			models: ids.map((id) => ({ id, label: id })),
			defaultModel: ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : ids[0],
			exampleDir: EXAMPLE_DIR,
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
	configFile: false,
	plugins: [react(), tailwindcss()],
	appType: "spa",
	server: { middlewareMode: true, hmr: { server: httpServer } },
});
httpServer.on("request", vite.middlewares);

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", connect);
httpServer.on("upgrade", (req, socket, head) => {
	if (req.url === "/ws") wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

async function shutdown() {
	await Promise.all([...sessionsById.values()].map((s) => s.dispose()));
	await vite.close();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.listen(Number(flags.port), "127.0.0.1", () => {
	const url = `http://127.0.0.1:${flags.port}/`;
	console.log(`s-ui running at ${url}`);
	if (!flags["no-open"]) openBrowser(url);
});
