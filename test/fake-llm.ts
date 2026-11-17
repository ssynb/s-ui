// 测试用的本地假模型：OpenAI 兼容的流式 chat completions 接口，回复固定，用来离线驱动真实的 pi 会话。
// 规则：最后一条是工具结果 → 回 "done"；用户说 "use a tool" → 调一次 bash；其余回 "ok"。
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

type ChatRequest = { model: string; messages: { role: string; content: unknown }[] };

function chunk(model: string, delta: object, finish: string | null = null) {
	return `data: ${JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 0, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
}

function reply(body: ChatRequest) {
	const last = body.messages.at(-1)!;
	if (last.role === "tool") return [chunk(body.model, { role: "assistant", content: "done" }), chunk(body.model, {}, "stop")];
	if (JSON.stringify(last.content).includes("use a tool")) {
		const call = { index: 0, id: "call_1", type: "function", function: { name: "bash", arguments: JSON.stringify({ command: "echo hi" }) } };
		return [chunk(body.model, { role: "assistant", tool_calls: [call] }), chunk(body.model, {}, "tool_calls")];
	}
	return [chunk(body.model, { role: "assistant", content: "ok" }), chunk(body.model, {}, "stop")];
}

/** 启动假模型，返回指向它的 ModelRuntime（模型 fake/fake-1、fake/fake-2）和收到的请求。 */
export async function startFakeLlm(dir: string, extraAuth: object = {}) {
	const requests: ChatRequest[] = [];
	const server = createServer(async (req, res) => {
		let raw = "";
		for await (const part of req) raw += part;
		const body = JSON.parse(raw) as ChatRequest;
		requests.push(body);
		res.writeHead(200, { "content-type": "text/event-stream" });
		for (const line of reply(body)) res.write(line);
		res.end("data: [DONE]\n\n");
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
	const model = (id: string) => ({ id, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } });
	const models = { providers: { fake: { baseUrl, api: "openai-completions", apiKey: "test", models: [model("fake-1"), model("fake-2")] } } };
	await writeFile(join(dir, "models.json"), JSON.stringify(models));
	await writeFile(join(dir, "auth.json"), JSON.stringify(extraAuth));
	const modelRuntime = await ModelRuntime.create({ authPath: join(dir, "auth.json"), modelsPath: join(dir, "models.json") });
	return { modelRuntime, requests, close: () => server.close() };
}
