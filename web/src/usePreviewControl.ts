import type { PreviewControl } from "./panels.ts";

const notImplemented = () => Promise.reject(new Error("preview control: not implemented yet"));

/**
 * 面板操作预览页面的入口（PanelProps.preview）。
 * TODO(预览桥)：经 PREVIEW_OP_MESSAGE 与预览里的桥接脚本通信；工作台记住已注入的样式层与字体，预览刷新后重新注入。
 */
export function usePreviewControl(_previewUrl?: string): PreviewControl {
	return {
		ready: false,
		applyLayer: notImplemented,
		clearLayer: notImplemented,
		clearAll: notImplemented,
		loadFonts: notImplemented,
		inspect: notImplemented,
		readTokens: notImplemented,
	};
}
