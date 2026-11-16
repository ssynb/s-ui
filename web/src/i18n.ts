import { useCallback, useState } from "react";

// 全部界面文案的唯一来源。新增文案时两种语言同时补齐，类型会检查缺漏。
const en = {
	folderPlaceholder: "Project folder path, e.g. ~/my-site (created if missing)",
	open: "Open",
	openExample: "Try the example",
	model: "Model",
	chatPlaceholder: "Tell the AI what to build or change…",
	send: "Send",
	stop: "Stop",
	thinking: "Working…",
	noFolder: "Open a project folder to start.",
	previewEmpty: "This folder has no page yet. Ask the AI, e.g. “Make a landing page for my coffee shop”.",
	previewInstalling: "Installing dependencies…",
	previewStarting: "Starting the page…",
	previewError: "The page failed to start",
	previewStopped: "The page server stopped",
	draw: "Circle to edit",
	drawing: "Drawing — drag around an area",
	annotationPlaceholder: "What should change here?",
	cancel: "Cancel",
	circledImage: "Circled area",
	pageStateTimeout: "Couldn't read the preview's current position. Reload the preview and try again.",
	disconnected: "Disconnected from s-ui. Restart it and reload this page.",
	language: "中文",
};

type Messages = typeof en;

const zh: Messages = {
	folderPlaceholder: "项目文件夹路径，例如 ~/my-site（不存在会新建）",
	open: "打开",
	openExample: "试试示例项目",
	model: "模型",
	chatPlaceholder: "告诉 AI 要做什么页面、改什么…",
	send: "发送",
	stop: "停止",
	thinking: "处理中…",
	noFolder: "先打开一个项目文件夹。",
	previewEmpty: "这个文件夹还没有页面。在左边对 AI 说，比如“做一个咖啡店的落地页”。",
	previewInstalling: "正在安装依赖…",
	previewStarting: "正在启动页面…",
	previewError: "页面启动失败",
	previewStopped: "页面服务已停止",
	draw: "画圈修改",
	drawing: "画圈中：拖动鼠标圈出区域",
	annotationPlaceholder: "这里要怎么改？",
	cancel: "取消",
	circledImage: "圈选区域",
	pageStateTimeout: "读不到预览当前的位置，请刷新预览后重试。",
	disconnected: "与 s-ui 的连接已断开，请重新启动后刷新页面。",
	language: "English",
};

const MESSAGES = { en, zh };
export type Locale = keyof typeof MESSAGES;
export type T = Messages;

const STORAGE_KEY = "s-ui.locale";

function initialLocale(): Locale {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === "en" || saved === "zh") return saved;
	return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function useI18n() {
	const [locale, setLocale] = useState(initialLocale);
	const toggle = useCallback(() => {
		setLocale((current) => {
			const next = current === "zh" ? "en" : "zh";
			localStorage.setItem(STORAGE_KEY, next);
			return next;
		});
	}, []);
	return { t: MESSAGES[locale], locale, toggle };
}
