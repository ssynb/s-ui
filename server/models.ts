import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

export type Model = ReturnType<ModelRuntime["getModels"]>[number];

export const DEFAULT_MODEL = "openai-codex/gpt-5.6-luna";

export const modelKey = (m: Model) => `${m.provider}/${m.id}`;

// pi-ai 遇到 Claude 订阅 OAuth 令牌时会伪装成 Claude Code 发请求，本产品不允许走这条路。
function isClaudeSubscription(runtime: ModelRuntime, m: Model) {
	return m.provider === "anthropic" && runtime.isUsingOAuth("anthropic");
}

export function isUsable(runtime: ModelRuntime, m: Model) {
	return !isClaudeSubscription(runtime, m);
}

export function assertUsable(runtime: ModelRuntime, m: Model) {
	if (!isUsable(runtime, m)) {
		throw new Error("Claude subscription OAuth is not supported; configure an Anthropic API key instead");
	}
}

export async function listUsableModels(runtime: ModelRuntime) {
	return (await runtime.getAvailable()).filter((m) => isUsable(runtime, m));
}
