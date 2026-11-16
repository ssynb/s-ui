# s-ui 模块索引

Node + TypeScript 后台（Node 原生类型剥离直接运行 `.ts`，无构建步骤）+ React 19 / Vite / Tailwind v4 前端。前端只通过一条 WebSocket（`/ws`）与后台交互，协议类型在 `server/protocol.ts`，前后端共用。

- `server/main.ts`：入口。HTTP 服务（Vite 中间件模式托管 `web/`）、WebSocket、按文件夹管理项目会话、自动打开浏览器、退出时清理。
- `server/project-session.ts`：项目会话深模块。拥有一个 pi 会话（`@earendil-works/pi-coding-agent` SDK）和该项目 dev server 的生命周期；对外只有 `open / prompt / subscribe / abort / dispose`，输出 `SessionEvent` 事件流。不加载用户 `~/.pi/agent` 下的扩展、技能和系统提示，只复用其凭据。
- `server/dev-server.ts`：安装依赖、启动 `dev` 脚本、从输出识别本地地址、按进程组停止。
- `server/annotate.ts`：Playwright 以预览视口打开页面，找圈内元素并截带圈注的图。
- `server/source-locator.ts`：按 id、文本、class 在项目源码里猜元素位置。
- `server/models.ts`：可用模型列表与默认模型；拒绝 Claude 订阅 OAuth（pi-ai 在该凭据下会伪装成 Claude Code）。
- `web/src/useWorkspace.ts`：WebSocket 连接与界面状态归约。
- `web/src/i18n.ts`：全部界面文案（中英）的唯一来源。
- `web/src/Preview.tsx`：预览 iframe 与画圈覆盖层；`web/src/Chat.tsx`：对话区。
- `examples/hello-page/`：最小示例项目。
- `test/`：验收测试，`npm test` 运行（需要网络安装示例依赖、已安装 Playwright Chromium）。

验证：`npm run typecheck`、`npm test`。
