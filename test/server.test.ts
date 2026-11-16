import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import type { ServerMessage } from "../server/protocol.ts";

const PORT = 5197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;

before(async () => {
	const appHome = await mkdtemp(join(tmpdir(), "s-ui-home-"));
	server = spawn(process.execPath, ["server/main.ts", "--no-open", "--port", String(PORT)], {
		stdio: ["ignore", "pipe", "inherit"],
		env: { ...process.env, S_UI_HOME: appHome },
	});
	await new Promise<void>((resolve) => server.stdout!.on("data", (d) => String(d).includes("running") && resolve()));
});
after(() => server.kill("SIGTERM"));

function connect(origin: string) {
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin });
	const messages: ServerMessage[] = [];
	const waiters: (() => void)[] = [];
	ws.on("message", (d) => {
		messages.push(JSON.parse(String(d)));
		waiters.splice(0).forEach((w) => w());
	});
	const until = async (match: (m: ServerMessage[]) => boolean) => {
		while (!match(messages)) await new Promise<void>((r) => waiters.push(r));
	};
	return { ws, messages, until };
}

test("a page from another origin cannot open the workbench socket", async () => {
	const { ws } = connect("https://untrusted.example");
	const outcome = await new Promise<string>((resolve) => {
		ws.on("open", () => resolve("open"));
		ws.on("error", (e) => resolve(e.message));
	});
	assert.match(outcome, /403/);
});

test("malformed messages are reported and do not take the server down", async () => {
	const client = connect(ORIGIN);
	await client.until((m) => m.some((x) => x.type === "hello"));
	client.ws.send("{broken-json");
	await client.until((m) => m.some((x) => x.type === "error"));
	assert.equal(server.exitCode, null);
	client.ws.close();
});

test("opening the same folder twice still delivers each session event once", async () => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-reopen-"));
	const client = connect(ORIGIN);
	await client.until((m) => m.some((x) => x.type === "hello"));
	const hello = client.messages.find((m) => m.type === "hello") as Extract<ServerMessage, { type: "hello" }>;
	for (let i = 0; i < 2; i++) client.ws.send(JSON.stringify({ type: "open", dir, model: hello.defaultModel }));
	await client.until((m) => m.filter((x) => x.type === "opened").length === 2);
	const { sessionId } = client.messages.find((m) => m.type === "opened") as Extract<ServerMessage, { type: "opened" }>;

	const annotation = { stroke: [[0, 0], [10, 0], [10, 10]], viewport: { width: 100, height: 100 }, capture: { href: "http://x/", scrollX: 0, scrollY: 0, html: "", elements: [] } };
	client.ws.send(JSON.stringify({ type: "prompt", sessionId, text: "x", annotation }));
	const isError = (m: ServerMessage) => m.type === "event" && m.event.type === "error";
	await client.until((m) => m.some(isError));
	await new Promise((r) => setTimeout(r, 300));
	assert.equal(client.messages.filter(isError).length, 1);
	client.ws.close();
});
