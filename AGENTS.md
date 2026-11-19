# s-ui 模块索引

Node + TypeScript 后台（Node 原生类型剥离直接运行 `.ts`，无构建步骤）+ React 19 / Vite / Tailwind v4 前端。前端只通过一条 WebSocket（`/ws`）与后台交互，协议类型在 `server/protocol.ts`，前后端共用。

- `server/main.ts`：入口。HTTP 服务（Vite 中间件模式托管 `web/`）、WebSocket（只接受工作台自身来源）、按文件夹管理项目会话、自动打开浏览器、退出时清理。
- `server/project-session.ts`：项目会话深模块。拥有该项目的对话（pi 持久化会话，可新建、切换、换模型）和 dev server 的生命周期；对外只有 `open / prompt / setModel / newConversation / switchConversation / selectPage / capturePage / subscribe / abort / dispose`，输出 `SessionEvent` 事件流，订阅时先重放当前对话。
- `server/conversations.ts`：对话的存储与还原：每个项目一个目录（`~/.s-ui/sessions/<名>-<哈希>/`，pi 的 JSONL 会话），创建 pi 会话（不加载用户 `~/.pi/agent` 下的扩展、技能和系统提示，只复用其凭据）、列出最近对话、从会话记录重建界面对话（用户原话另记为自定义条目）。
- 项目与选页发现：`server/project-discovery.ts`；`main.ts` 在创建会话前发现直接子项目，多个通过 `projectChoices` 回给界面，选中后才启动。`ProjectSession` 保存已发现的页面和选择，校验 `selectPage / capturePage` 的路径属于当前预览；`server/project-page-shot.ts` 只截该预览的真实成功 HTML 响应，不接受外部 URL、不跟随跳转。验收：`test/project-pages.test.ts`。
- `server/dev-server.ts`：安装依赖、启动 `dev` 脚本、从输出识别本地地址、按进程组停止。
- `server/preview-proxy.ts`：每个预览的本地反向代理（含 HMR WebSocket），向 HTML 注入桥接脚本，只应工作台页面的请求：在预览里采集圈注现场，执行预览操作。
- `server/preview-ops.ts`：桥接脚本里的预览操作（自包含，注入页面）：临时样式层（放在文档最末并在有新节点追加到其后时移回最末，记在预览页面的 sessionStorage，刷新、热更新后自己恢复）、网页字体、识别组件、读设计变量；消息形状 `PreviewOp` / `PreviewOpReply` / `PreviewAnnouncement`（ready、leaving）。 风格试用层例外：按页面访问标识隔离，不持久化，SPA 切页与 pagehide 在预览端同步清除；普通打磨层继续刷新恢复。
- `server/page-capture.ts`：在用户的预览页面里执行的采集函数（自包含，会被转成字符串注入）：找圈内元素、拍 DOM 快照。
- `server/annotate.ts`：Playwright 以相同视口渲染快照、还原弹窗与滚动、画圈截图，并给圈内元素补源码位置。
- `server/source-locator.ts`：按 id、文本、class 在项目源码里猜元素位置。
- `server/projects.ts`：最近项目（持久化到 `~/.s-ui/config.json`）、列目录（供应用内文件夹选择框）、新建项目文件夹、示例项目副本（`prepareExample`：首次复制到 `APP_HOME/examples/`，之后复用，仓库里的示例不被改动）；`server/app-home.ts` 定义 s-ui 自己的目录（默认 `~/.s-ui`，`S_UI_HOME` 可覆盖）。
- `server/modules.ts`：后台功能模块注册表；`server/module-kit.ts`：模块工具（`defineModule`、`dispatchModule`、`ModuleContext`；会改项目文件的模块动作用 `ctx.project.exclusive` 包起来，对应 `ProjectSession.runExclusive`：对话 AI 工作时拒绝，执行期间对话消息被拒绝；`exclusive` 事件驱动输入框锁定，`busy:*` 错误码由框架 i18n 翻译）；`server/modules/<名>.ts`：各模块（如 `references.ts`），声明自己的 `<名>Api` 类型。前端经 `{ type: "module", module, action, payload }` 调用，main.ts 只转发。
- `server/design-tokens.ts`：设计变量约定（前后端共用）：`TOKENS_FILE`（`src/design-tokens.css`）与 `DESIGN_TOKENS`（`--sui-font-*`、`--sui-color-*`、`--sui-radius-*`、`--sui-shadow-*`、`--sui-space`）。「打磨」只改这些变量。
- `server/modules/polish.ts`：「打磨」后台模块，`PolishApi`：`status`（变量文件状态与当前值）、`organize`（一次性 AI 子会话把散落样式收拢成设计变量，外观不变，推进度）、`saveTokens`（确定性写回变量值与字体 @import，不经 AI）。实现分在 `server/tokens-file.ts`（解析与确定性改写，拒绝会越出声明的值——结束符、注释、转义、未闭合的引号、未按嵌套配平的圆括号与方括号——和非 https 的字体地址）与 `server/organize-tokens.ts`（AI 整理；独占项目执行，整理用的 AI 只有只读工具和记账的 edit/write；整理前后整页截图比对，外观变了先请 AI 对照截图修一次，仍不一致或中途失败都撤销整理自己的写入）；`server/write-ledger.ts` 记下 AI 每个文件第一次写之前的内容和最后写入的内容；AI 再写它写过的文件前核对内容未被别人改过，改过就拒绝覆盖并把文件交还；撤销只动此刻仍是 AI 写入内容的文件，别人期间的改动原样保留并在说明里列出；文件只能写在项目根之下；截图与比对在 `server/appearance.ts`，桌面（1280×800）与窄屏（390×844）都必须通过。
- `server/page-inspect.ts`：在预览页面里识别实际存在的组件（类别、数量、代表/成组选择器、关键计算样式）、字体与颜色；`inspectPage` 自包含，经桥接脚本执行；类型 `PageInspection` 为契约。
- `server/models.ts`：可用模型列表与默认模型；拒绝 Claude 订阅 OAuth（pi-ai 在该凭据下会伪装成 Claude Code）。
- `web/src/useWorkspace.ts`：WebSocket 连接与界面状态归约；带 `requestId` 的命令（打开、新建、列目录）可等待结果。
- `web/src/i18n.ts`：框架文案（中英）的唯一来源。**每个工具窗拥有自己的文案字典**（`web/src/<面板>/strings.ts`，结构同 i18n.ts：`en` 定型、`zh: typeof en`），框架文案在 i18n.ts。
- `web/src/styles.css`：设计 token（参照 JetBrains 新 UI，浅色/深色跟随系统）；`web/src/ui.tsx`：共享控件（按钮、菜单、模态框、项目图标），密度统一为 compact。
- `web/src/panels.ts`：工具窗面板契约（冻结）——`PanelDefinition`、`PanelProps`（语言、项目信息、圈选上下文、`submitToAi` 统一交给 AI、`showChat`、`callModule` 调后台模块、`preview` 操作预览页面：临时样式层、字体、识别组件、读设计变量），以及跨面板嵌入部件的 props（`SimilarProductsProps`、`StartFromReferenceProps`）。
- `web/src/usePreviewControl.ts`：`PanelProps.preview` 的实现：经 `PREVIEW_OP_MESSAGE` 与预览桥接脚本通信；`ready` 跟随桥接脚本的 ready/leaving 通知；工作区刚打开时先清掉上次留下的样式层。预览 iframe 的 ref 由 `Workspace` 持有，`Preview` 与它共用。
- 选页界面：`web/src/ProjectPages.tsx` 复用参考页面的卡片与 `ScreenshotView.tsx` 整页视图，截图失败也可选；`Workspace.tsx` 把所选路由交给原预览 iframe，圈选与打磨不走截图数据。空文件夹与有内容但无启动入口分别是 `empty`、`missing` 预览状态。
- `web/src/ToolWindows.tsx`：JetBrains 式左侧工具窗条与工具窗注册表（对话为内置默认）；`web/src/Workspace.tsx`：打开项目后的工作区，持有圈选与当前工具窗，组装 `PanelProps`。
- `web/src/polish/`、`web/src/references/`：「打磨」「参考页面」工具窗，各含 `index.ts`（PanelDefinition）、面板组件、`strings.ts`。参考页面另导出两个部件：`SimilarProducts.tsx`（同类产品参考，可嵌入打磨，`compact` 为两列小卡片）、`StartFromReference.tsx`（空项目时预览区内容，由 `Workspace` 经 `Preview` 的 `empty` 渲染：按描述找同类或选精选，“照这个做”让 AI 照参考搭页面并按 `server/design-tokens.ts` 生成变量文件）。找同类状态按项目共享在 `web/src/references/similarSearch.ts`，三处共用、不重复查找。
- `web/src/polish/` 打磨：`PolishPanel.tsx` 组装四个标签。`TokenSections.tsx` 按用途试用并保存字体；控件字体为向后兼容的可选变量。`PageSections.tsx` 与 `targets.ts` 管当前页面的组件实例和动效；确认前重新核对目标。`style/AGENTS.md` 说明参考风格试用与确认边界。
- 多处圈注：`web/src/AnnotationEditor.tsx` 编辑编号和备注；`server/annotation-bridge.ts` 给现场附加文档与视图身份，`server/multi-annotation.ts` 按现场合并编号图。
- 参考页面：后台 `server/modules/references.ts`（`findSimilar` 找同类，给 `description` 时按描述、不读项目；`capture` 截图）组合 `similar-products.ts`（一次性只读 pi 子会话判断产品类型、凭模型知识给候选 URL）与 `page-shots.ts`（Playwright 打开、关弹窗、剔除错误页/登录墙/空页、截首屏或整页，按 URL 缓存到 `APP_HOME/reference-shots`，7 天过期）；前端 `web/src/references/curated.ts` 是按页面类型整理的精选清单。
- `web/src/App.tsx` 组装：`Toolbar.tsx`（项目切换、模型、语言、运行状态）、`Welcome.tsx`（未打开项目时）、`Workspace.tsx`、`Chat.tsx`（对话工具窗，Markdown、工具调用折叠）、`ConversationActions.tsx`（新对话、最近对话）、`Preview.tsx`（标签栏、地址条、画圈覆盖层；松手即采集现场成为圈选）、`StatusBar.tsx`、`FolderPicker.tsx`、`NewProjectDialog.tsx`。
- `examples/hello-page/`：最小示例项目（只作为复制源；“打开示例项目”打开的是 `APP_HOME/examples/` 里的副本）。
- `test/`：验收测试，`npm test` 运行（需要网络安装示例依赖、已安装 Playwright Chromium）。`test/setup.ts` 把 `S_UI_HOME` 指向临时目录；`test/fake-llm.ts` 是本地假模型（OpenAI 兼容，可自定义回复），离线驱动真实 pi 会话；`test/page-fixture.ts` 是带常见组件的测试页面。测试里创建的会话与服务一律在 `t.after`/`after` 里清理，失败时进程也能退出。

验证：`npm run typecheck`、`npm test`。
