# 风格试用

- `StylePanel.tsx` 是集成入口，只接收 `{ panel: PanelProps }`；分区导航由调用方提供。
- `trial.ts` 拥有试用生命周期：模型生成不改文件，确认前只注入独立样式层，取消使未完成回复失效；确认交给 `submitToAi`，附参考图片、URL 与实际试过的声明。
- 后台 `server/modules/style.ts` 直接发一次无工具模型请求，不创建项目 Agent 会话、不加载项目指令。`style-plan.ts` 是允许属性和值的唯一来源；选择器只来自本次页面识别，标题只改代表实例，避免抹平所有标题层级。

## 集成边界

风格试用使用 `style-scope.ts` 的保留层命名空间，并绑定桥接识别结果中的页面访问标识。预览桥接在 SPA 路由变化和 pagehide 时自行删除这类层，不将它写入 sessionStorage，也不恢复已有存储中的风格层；页面标识不匹配的迟到请求直接拒绝。普通打磨层仍按原规则持久化。

`lifecycle.ts` 将控制层已验证来源的离开/就绪通知交给面板，立即使旧方案与未完成请求失效；即使面板已卸载，预览端清理也不依赖面板调用。确认还会核对页面访问标识，并在清理等待期间继续响应取消/离开。验收包含真实桥接导航和挂载真实 StylePanel 的浏览器测试：`test/polish-style-navigation.test.ts`、`test/polish-style-panel.test.ts`；并发取消与清理失败重试在 `test/polish-style-races.test.ts`。

模型提出的颜色与布局不是视觉质量保证。参考图与实际样式需由用户在真实页面检查，确认后的源码实现也不承诺逐像素相同。
