// 「参考页面」工具窗的后台模块（占位）。动作与载荷类型在 ReferencesApi 里声明，前端面板按同一类型调用。
import { defineModule } from "../module-kit.ts";

/** 动作名 → { payload, result }。 */
export type ReferencesApi = Record<never, never>;

export const referencesModule = defineModule<ReferencesApi>({});
