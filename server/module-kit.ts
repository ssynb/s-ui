// 后台功能模块的工具：工具窗面板需要的后台能力（截图任意网页、一次性 AI 子会话等）各写成一个模块，
// 经同一条 WebSocket 以 { module, action, payload } 调用。main.ts 只负责转发，不知道任何模块的细节。
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { Model } from "./models.ts";
import type { ModuleApi } from "./protocol.ts";

/** 模块动作执行时可用的上下文。 */
export type ModuleContext = {
	/** 本机 pi 凭据与模型目录，可用来开一次性子会话。 */
	modelRuntime: ModelRuntime;
	/**
	 * 调用方当前打开的项目；未打开项目时为空。previewUrl 为预览页面地址（经 s-ui 转发），页面没跑起来时为空。
	 * 会改项目文件的动作用 exclusive 包起来：对话 AI 在工作时拒绝执行，执行期间对话消息被拒绝。
	 */
	project?: { dir: string; model: Model; previewUrl?: string; exclusive: <T>(task: string, fn: () => Promise<T>) => Promise<T> };
	/** 向发起调用的页面推送进度，可多次调用；数据形状由模块自己约定。 */
	progress: (data: unknown) => void;
};

export type ModuleHandler = (action: string, payload: unknown, ctx: ModuleContext) => Promise<unknown>;

/** 按模块自己的 Api 类型写动作表，得到可注册的处理函数。 */
export function defineModule<Api extends ModuleApi>(actions: {
	[A in keyof Api]: (payload: Api[A]["payload"], ctx: ModuleContext) => Promise<Api[A]["result"]>;
}): ModuleHandler {
	return (action, payload, ctx) => {
		const run = Object.hasOwn(actions, action) ? actions[action as keyof Api] : undefined;
		if (!run) throw new Error(`Unknown module action: ${action}`);
		return run(payload as Api[keyof Api]["payload"], ctx);
	};
}

export async function dispatchModule(
	registry: Record<string, ModuleHandler>,
	call: { module: string; action: string; payload: unknown },
	ctx: ModuleContext,
) {
	const handler = Object.hasOwn(registry, call.module) ? registry[call.module] : undefined;
	if (!handler) throw new Error(`Unknown module: ${call.module}`);
	return handler(call.action, call.payload, ctx);
}
