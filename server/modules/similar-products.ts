// 用一次性 pi 子会话读当前项目，判断产品与页面类型，并凭模型知识列出同类真实产品的页面地址。
// 没有搜索 API：地址可能过时或编造，调用方必须逐个打开验证。
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, type ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { APP_HOME } from "../app-home.ts";
import { assertUsable, type Model } from "../models.ts";
import { normalizeUrl } from "./page-shots.ts";

export type ProductGuess = { kind: string; page: string; summary: string };
export type Candidate = { name: string; url: string; why: string };

const APP_AGENT_DIR = join(APP_HOME, "agent");
const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"];
const CANDIDATE_COUNT = 10;
const LANGUAGE = { en: "English", zh: "Simplified Chinese" } as const;

const FINDER_PROMPT = `You help a designer find reference pages for the web project in the current directory. You can only read files.`;

function task(language: string) {
	return `1. Inspect the project with the read-only tools: package.json, index.html and the source of the main page (read at most about 8 files). Decide what kind of product this is and what kind of page the main page is (landing page, pricing page, dashboard, chat UI, settings, portfolio, product detail…).
2. List ${CANDIDATE_COUNT} real, currently live products of the same kind whose public page of the same type is a strong design reference (known for good design). Give the exact URL of the matching page: the homepage for a landing page, the pricing page for a pricing page, and so on. Only URLs you are confident exist and can be viewed without logging in.

Reply with JSON only, no code fence:
{"product":{"kind":"…","page":"…","summary":"…"},"candidates":[{"name":"…","url":"https://…","why":"…"}]}
kind: the product type; page: the page type; summary: one sentence on what the project is. why: one sentence on what is worth borrowing from that page.
Write kind, page, summary and why in ${language}.`;
}

async function ask(dir: string, modelRuntime: ModelRuntime, model: Model, prompt: string) {
	const settingsManager = SettingsManager.inMemory({});
	const resourceLoader = new DefaultResourceLoader({
		cwd: dir,
		agentDir: APP_AGENT_DIR,
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		appendSystemPrompt: [FINDER_PROMPT],
	});
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd: dir,
		agentDir: APP_AGENT_DIR,
		modelRuntime,
		model,
		thinkingLevel: "low",
		tools: READ_ONLY_TOOLS,
		resourceLoader,
		settingsManager,
		sessionManager: SessionManager.inMemory(dir),
	});
	try {
		await session.prompt(prompt);
		return session.getLastAssistantText() ?? "";
	} finally {
		session.dispose();
	}
}

function parseAnswer(text: string) {
	const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
	let answer: { product?: Partial<ProductGuess>; candidates?: Partial<Candidate>[] };
	try {
		answer = JSON.parse(json);
	} catch {
		throw new Error(`The AI did not return valid JSON: ${text.slice(0, 200)}`);
	}
	const { kind = "", page = "", summary = "" } = answer.product ?? {};
	const seen = new Set<string>();
	const candidates: Candidate[] = [];
	for (const c of answer.candidates ?? []) {
		const url = normalizeUrl(String(c.url ?? ""));
		if (!url || seen.has(url)) continue;
		seen.add(url);
		candidates.push({ name: String(c.name ?? new URL(url).hostname), url, why: String(c.why ?? "") });
	}
	return { product: { kind, page, summary }, candidates };
}

/** 读项目，返回产品判断与候选页面（未验证）。 */
export async function guessSimilarProducts(dir: string, modelRuntime: ModelRuntime, model: Model, locale: keyof typeof LANGUAGE) {
	assertUsable(modelRuntime, model);
	return parseAnswer(await ask(dir, modelRuntime, model, task(LANGUAGE[locale])));
}
