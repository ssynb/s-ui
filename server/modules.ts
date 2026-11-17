// 后台功能模块的注册表。工具窗面板需要的后台能力（截图任意网页、一次性 AI 子会话等）各写成 server/modules/ 下的一个模块，
// 经同一条 WebSocket 以 { module, action, payload } 调用；main.ts 只转发到这里，不知道任何模块的细节。
import { type ModuleHandler } from "./module-kit.ts";
import { referencesModule } from "./modules/references.ts";

export * from "./module-kit.ts";

/** 已注册的模块。新增模块：在 server/modules/ 下写一个文件，再在这里加一行。 */
export const MODULES: Record<string, ModuleHandler> = {
	references: referencesModule,
};
