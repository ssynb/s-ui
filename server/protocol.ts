// WebSocket 协议：前端与后台之间唯一的通道。前后端共享这一份类型。
import type { PageCapture } from "./page-capture.ts";

export type Point = [x: number, y: number];
export type Viewport = { width: number; height: number };

/** 工作台请预览 iframe 采集现场时 postMessage 用的消息类型（请求与回复相同）。 */
export const PAGE_CAPTURE_MESSAGE = "s-ui:page-capture";

/** 用户在预览上画的圈：坐标是预览视口内的 CSS 像素；capture 是预览页面在画圈那一刻的现场。 */
export type Annotation = { stroke: Point[]; viewport: Viewport; capture: PageCapture };

export type PreviewState = "empty" | "installing" | "starting" | "ready" | "error" | "stopped";

/** 单个项目会话发出的事件。 */
export type SessionEvent =
	| { type: "preview"; state: PreviewState; url?: string; message?: string }
	| { type: "user"; text: string; image?: string }
	| { type: "assistant_delta"; text: string }
	| { type: "assistant_end" }
	| { type: "tool"; phase: "start" | "end"; id: string; name: string; summary: string; isError?: boolean }
	| { type: "busy"; busy: boolean }
	| { type: "error"; message: string };

export type ModelInfo = { id: string; label: string };

export type ClientMessage =
	| { type: "open"; dir: string; model: string }
	| { type: "prompt"; sessionId: string; text: string; annotation?: Annotation }
	| { type: "abort"; sessionId: string };

export type ServerMessage =
	| { type: "hello"; models: ModelInfo[]; defaultModel?: string; exampleDir: string }
	| { type: "opened"; sessionId: string; dir: string }
	| { type: "event"; sessionId: string; event: SessionEvent }
	| { type: "error"; message: string };
