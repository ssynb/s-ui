# s-ui 模块索引

Node + TypeScript 后台（Node 原生类型剥离直接运行 `.ts`，无构建步骤）+ React 19 / Vite / Tailwind v4 前端。前端只通过一条 WebSocket（`/ws`）与后台交互，协议类型在 `server/protocol.ts`，前后端共用。

- `server/main.ts`：入口。HTTP 服务（Vite 中间件模式托管 `web/`）、WebSocket（只接受工作台自身来源）、按文件夹管理项目会话、自动打开浏览器、退出时清理。
- `server/project-session.ts`：项目会话深模块。拥有该项目的对话（pi 持久化会话，可新建、切换、换模型）和 dev server 的生命周期；对外只有 `open / prompt / setModel / newConversation / switchConversation / subscribe / abort / dispose`，输出 `SessionEvent` 事件流，订阅时先重放当前对话。
- `server/conversations.ts`：对话的存储与还原：每个项目一个目录（`~/.s-ui/sessions/<名>-<哈希>/`，pi 的 JSONL 会话），创建 pi 会话（不加载用户 `~/.pi/agent` 下的扩展、技能和系统提示，只复用其凭据）、列出最近对话、从会话记录重建界面对话（用户原话另记为自定义条目）。
- `server/dev-server.ts`：安装依赖、启动 `dev` 脚本、从输出识别本地地址、按进程组停止。
- `server/preview-proxy.ts`：每个预览的本地反向代理（含 HMR WebSocket），向 HTML 注入桥接脚本，只应工作台页面的请求在预览里采集圈注现场。
- `server/page-capture.ts`：在用户的预览页面里执行的采集函数（自包含，会被转成字符串注入）：找圈内元素、拍 DOM 快照。
- `server/annotate.ts`：Playwright 以相同视口渲染快照、还原弹窗与滚动、画圈截图，并给圈内元素补源码位置。
- `server/source-locator.ts`：按 id、文本、class 在项目源码里猜元素位置。
- `server/projects.ts`：最近项目（持久化到 `~/.s-ui/config.json`）、列目录（供应用内文件夹选择框）、新建项目文件夹；`server/app-home.ts` 定义 s-ui 自己的目录（默认 `~/.s-ui`，`S_UI_HOME` 可覆盖）。
- `server/modules.ts`：后台功能模块注册表；`server/module-kit.ts`：模块工具（`defineModule`、`dispatchModule`、`ModuleContext`）；`server/modules/<名>.ts`：各模块（如 `references.ts`），声明自己的 `<名>Api` 类型。前端经 `{ type: "module", module, action, payload }` 调用，main.ts 只转发。
- `server/models.ts`：可用模型列表与默认模型；拒绝 Claude 订阅 OAuth（pi-ai 在该凭据下会伪装成 Claude Code）。
- `web/src/useWorkspace.ts`：WebSocket 连接与界面状态归约；带 `requestId` 的命令（打开、新建、列目录）可等待结果。
- `web/src/i18n.ts`：框架文案（中英）的唯一来源。**每个工具窗拥有自己的文案字典**（`web/src/<面板>/strings.ts`，结构同 i18n.ts：`en` 定型、`zh: typeof en`），框架文案在 i18n.ts。
- `web/src/styles.css`：设计 token（参照 JetBrains 新 UI，浅色/深色跟随系统）；`web/src/ui.tsx`：共享控件（按钮、菜单、模态框、项目图标），密度统一为 compact。
- `web/src/panels.ts`：工具窗面板契约（冻结）——`PanelDefinition`、`PanelProps`（语言、项目信息、圈选上下文、`submitToAi` 统一交给 AI、`showChat`、`callModule` 调后台模块）。
- `web/src/ToolWindows.tsx`：JetBrains 式左侧工具窗条与工具窗注册表（对话为内置默认）；`web/src/Workspace.tsx`：打开项目后的工作区，持有圈选与当前工具窗，组装 `PanelProps`。
- `web/src/library/`、`web/src/references/`：「组件库」「参考页面」工具窗，各含 `index.ts`（PanelDefinition）、面板组件、`strings.ts`。
- `web/src/library/` 组件库：`registry.ts` 是条目注册表（分类 + 全部条目），条目定义在 `motion.tsx`（动效词典 23 项）和 `components.tsx`（产品组件，每类多种做法）；一个条目一个 `Entry` 对象（`types.ts`：演示组件、参数 schema、`describe` 生成“怎么跟 AI 说”），常用参数工厂在 `params.ts`；`prompt.ts` 把选择拼成交给 AI 的结构化需求（纯函数，`test/library.test.ts` 覆盖）；`LibraryPanel.tsx` 筛选/搜索/放慢，`EntryCard.tsx` 并排比较、调参与“用这个”；演示样式与关键帧在 `library.css`，参数经 CSS 变量传入。
- 参考页面：后台 `server/modules/references.ts`（`findSimilar` 找同类、`capture` 截图）组合 `similar-products.ts`（一次性只读 pi 子会话判断产品类型、凭模型知识给候选 URL）与 `page-shots.ts`（Playwright 打开、关弹窗、剔除错误页/登录墙/空页、截首屏或整页，按 URL 缓存到 `APP_HOME/reference-shots`，7 天过期）；前端 `web/src/references/curated.ts` 是按页面类型整理的精选清单。
- `web/src/App.tsx` 组装：`Toolbar.tsx`（项目切换、模型、语言、运行状态）、`Welcome.tsx`（未打开项目时）、`Workspace.tsx`、`Chat.tsx`（对话工具窗，Markdown、工具调用折叠）、`ConversationActions.tsx`（新对话、最近对话）、`Preview.tsx`（标签栏、地址条、画圈覆盖层；松手即采集现场成为圈选）、`StatusBar.tsx`、`FolderPicker.tsx`、`NewProjectDialog.tsx`。
- `examples/hello-page/`：最小示例项目。
- `test/`：验收测试，`npm test` 运行（需要网络安装示例依赖、已安装 Playwright Chromium）。`test/setup.ts` 把 `S_UI_HOME` 指向临时目录；`test/fake-llm.ts` 是本地假模型（OpenAI 兼容），离线驱动真实 pi 会话。

验证：`npm run typecheck`、`npm test`。
