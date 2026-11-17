// WebSocket 协议：前端与后台之间唯一的通道。前后端共享这一份类型。
import type { PageCapture } from "./page-capture.ts";

export type Point = [x: number, y: number];
export type Viewport = { width: number; height: number };

/** 工作台请预览 iframe 采集现场时 postMessage 用的消息类型（请求与回复相同）。 */
export const PAGE_CAPTURE_MESSAGE = "s-ui:page-capture";
/** 工作台操作预览页面（临时样式层、字体、识别组件、读设计变量）时 postMessage 用的消息类型（请求与回复相同）。 */
export const PREVIEW_OP_MESSAGE = "s-ui:preview-op";

/** 用户在预览上画的圈：坐标是预览视口内的 CSS 像素；capture 是预览页面在画圈那一刻的现场。 */
export type Annotation = { stroke: Point[]; viewport: Viewport; capture: PageCapture };

/** 随消息交给 AI 的图片（如参考页面截图）。 */
export type ImageAttachment = { data: string; mimeType: ImageMimeType };
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** 后台模块的接口描述：动作名 → { payload, result }。各模块在 server/modules/<名>.ts 里声明自己的。 */
export type ModuleApi = Record<string, { payload: unknown; result: unknown }>;

export type PreviewState = "empty" | "installing" | "starting" | "ready" | "error" | "stopped";

/** 项目里的一次对话（pi 会话）。 */
export type ConversationInfo = { id: string; title: string; updatedAt: number };

/** 单个项目会话发出的事件。订阅时会先重放：conversation、当前对话内容、conversations、model、preview、busy。 */
export type SessionEvent =
	/** 之后的对话内容属于这个对话；界面据此清空再重建。 */
	| { type: "conversation"; id: string }
	| { type: "conversations"; list: ConversationInfo[] }
	/** 当前使用的模型（provider/id），切换后下一条消息起生效。 */
	| { type: "model"; model: string }
	| { type: "preview"; state: PreviewState; url?: string; message?: string }
	| { type: "user"; text: string; images: string[] }
	| { type: "assistant_delta"; text: string }
	| { type: "assistant_end" }
	| { type: "tool"; phase: "start" | "end"; id: string; name: string; summary: string; isError?: boolean }
	| { type: "busy"; busy: boolean }
	| { type: "error"; message: string };

export type ModelInfo = { id: string; label: string };

export type FolderEntry = { name: string; path: string; isProject: boolean };
export type FolderListing = { path: string; parent: string | null; entries: FolderEntry[] };

/** 常用位置的快捷入口；key 由界面翻译成名字，盘符（Windows）直接显示路径。 */
export type Place = { key: "home" | "desktop" | "documents" | "drive"; path: string };

// 带 requestId 的命令，结果（opened / folder / moduleResult）或失败（error）回带同一个 requestId。
export type ClientMessage =
	| { type: "open"; requestId: string; dir: string; model: string }
	| { type: "createProject"; requestId: string; parent: string; name: string; model: string }
	| { type: "listFolder"; requestId: string; path: string }
	| { type: "prompt"; sessionId: string; text: string; annotation?: Annotation; images?: ImageAttachment[] }
	| { type: "module"; requestId: string; sessionId?: string; module: string; action: string; payload: unknown }
	| { type: "abort"; sessionId: string }
	| { type: "setModel"; sessionId: string; model: string }
	| { type: "newConversation"; sessionId: string }
	| { type: "switchConversation"; sessionId: string; conversationId: string };

export type ServerMessage =
	| { type: "hello"; models: ModelInfo[]; defaultModel?: string; exampleDir: string; home: string; places: Place[]; recentProjects: string[] }
	| { type: "opened"; requestId?: string; sessionId: string; dir: string; model: string }
	| { type: "recentProjects"; projects: string[] }
	| { type: "folder"; requestId: string; listing: FolderListing }
	| { type: "event"; sessionId: string; event: SessionEvent }
	| { type: "moduleProgress"; requestId: string; data: unknown }
	| { type: "moduleResult"; requestId: string; result: unknown }
	| { type: "error"; requestId?: string; code?: string; message: string };
