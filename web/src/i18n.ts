import { useCallback, useEffect, useState } from "react";

// 框架界面文案的唯一来源（各工具窗面板的文案在各自目录的 strings.ts）。新增文案时两种语言同时补齐，类型会检查缺漏。
const en = {
	tagline: "Design web pages by chatting and circling",
	chooseProject: "Choose project",
	choosePage: "Choose page",
	openPage: (path: string) => `Open full page: ${path}`,
	changePage: "Change page",
	selectPage: "Select this page",
	shotFailed: "Screenshot unavailable",
	previewMissing: "No startup entry found",
	recentProjects: "Recent projects",
	openFolder: "Open folder…",
	newProject: "New project…",
	tryExample: "Open example project",
	model: "Model",
	modelHint: "Model for the AI; a change applies from the next message",
	language: "中文",
	languageLabel: "Switch language",
	noRecent: "No projects yet",
	noRecentHint: "Open a front-end project folder, or create an empty project and let the AI build the page.",

	openFolderTitle: "Open folder",
	chooseLocationTitle: "Choose location",
	pathLabel: "Folder path",
	up: "Parent folder",
	places: { home: "Home", desktop: "Desktop", documents: "Documents" },
	frontendProject: "Front-end project",
	noSubfolders: "No subfolders",
	open: "Open",
	choose: "Choose",
	cancel: "Cancel",

	newProjectTitle: "New project",
	projectName: "Project name",
	location: "Location",
	change: "Change…",
	create: "Create",
	newProjectHint: "Creates an empty folder. Then tell the AI what page you want.",

	errors: {
		ENOENT: "The folder doesn't exist",
		EEXIST: "A folder with this name already exists",
		EACCES: "No permission to access this folder",
		EPERM: "No permission to access this folder",
		ENOTDIR: "This isn't a folder",
		EINVAL: "The project name must be a single folder name",
		"busy:organizing": "Design settings are being organized. Send your message when that finishes.",
		"busy:savingTokens": "Design settings are being saved. Try again in a moment.",
		"busy:ai": "The AI is still working on the project. Try again when it finishes.",
	} as Record<string, string>,

	chatTitle: "AI chat",
	newConversation: "New conversation",
	recentConversations: "Recent conversations",
	conversationHistory: "Conversation history",
	emptyConversation: "New conversation",
	chatPlaceholder: "Describe the page you want, or what to change…",
	send: "Send",
	stop: "Stop",
	sendHint: "Enter to send · Shift+Enter for a new line",
	toolsSummary: (n: number) => (n === 1 ? "Ran 1 action" : `Ran ${n} actions`),
	attachedImage: "Attached image",
	exclusive: { organizing: "Organizing design settings…", savingTokens: "Saving design settings…" },
	showAll: "Show all",
	showLess: "Show less",
	toolWindows: "Tool windows",

	previewTab: "Preview",
	reload: "Reload preview",
	draw: "Circle to edit",
	exitDraw: "Exit circling",
	drawingBanner: "Circle the area you want to change",
	escToExit: "Esc to exit",
	annotationPlaceholder: "What should change here?",
	circleNote: "Note for circle",
	deleteCircle: "Delete circle",
	overallRequest: "Overall request",
	sendChanges: "Send changes",
	captureFailed: "Couldn't capture the circled area from the preview. Reload the preview and try again.",
	previewEmpty: "This folder has no page yet. Tell the AI what to build, e.g. “a landing page for my coffee shop”.",
	previewInstalling: "Installing dependencies…",
	previewStarting: "Starting the page…",
	previewError: "The page failed to start",
	previewStopped: "The page server stopped",

	devRunning: "Page running",
	devInstalling: "Installing dependencies",
	devStarting: "Starting page",
	devError: "Page failed to start",
	devStopped: "Page server stopped",
	devEmpty: "No page yet",
	noProject: "No project open",
	sessionIdle: "AI idle",
	sessionBusy: "AI working…",
	disconnected: "Disconnected from s-ui. Restart it and reload this page.",
};

type Messages = typeof en;

const zh: Messages = {
	tagline: "用对话和画圈设计你的网页",
	chooseProject: "选择项目",
	choosePage: "选择页面",
	openPage: (path: string) => `查看整页：${path}`,
	changePage: "切换页面",
	selectPage: "选这个页面",
	shotFailed: "截图不可用",
	previewMissing: "未找到启动入口",
	recentProjects: "最近项目",
	openFolder: "打开文件夹…",
	newProject: "新建项目…",
	tryExample: "打开示例项目",
	model: "模型",
	modelHint: "AI 使用的模型，切换后从下一条消息起生效",
	language: "English",
	languageLabel: "切换语言",
	noRecent: "还没有打开过项目",
	noRecentHint: "打开一个前端项目文件夹，或新建一个空项目让 AI 来做页面。",

	openFolderTitle: "打开文件夹",
	chooseLocationTitle: "选择存放位置",
	pathLabel: "文件夹路径",
	up: "上一级",
	places: { home: "主目录", desktop: "桌面", documents: "文稿" },
	frontendProject: "前端项目",
	noSubfolders: "没有子文件夹",
	open: "打开",
	choose: "选择",
	cancel: "取消",

	newProjectTitle: "新建项目",
	projectName: "项目名称",
	location: "位置",
	change: "更改…",
	create: "创建",
	newProjectHint: "会新建一个空文件夹，打开后对 AI 说你想要什么页面。",

	errors: {
		ENOENT: "文件夹不存在",
		EEXIST: "同名文件夹已存在",
		EACCES: "没有权限访问这个文件夹",
		EPERM: "没有权限访问这个文件夹",
		ENOTDIR: "这不是一个文件夹",
		EINVAL: "项目名称只能是一个文件夹名",
		"busy:organizing": "正在整理设计设置，整理完再发消息。",
		"busy:savingTokens": "正在保存设计设置，请稍后再试。",
		"busy:ai": "AI 还在处理这个项目，等它完成后再试。",
	},

	chatTitle: "AI 对话",
	newConversation: "新对话",
	recentConversations: "最近对话",
	conversationHistory: "对话记录",
	emptyConversation: "新对话",
	chatPlaceholder: "说说你想要什么页面，或者要改哪里…",
	send: "发送",
	stop: "停止",
	sendHint: "Enter 发送 · Shift+Enter 换行",
	toolsSummary: (n: number) => `执行了 ${n} 个操作`,
	attachedImage: "附带的图片",
	exclusive: { organizing: "正在整理设计设置…", savingTokens: "正在保存设计设置…" },
	showAll: "展开全部",
	showLess: "收起",
	toolWindows: "工具窗",

	previewTab: "预览",
	reload: "刷新预览",
	draw: "画圈修改",
	exitDraw: "退出画圈",
	drawingBanner: "在页面上圈出要改的地方",
	escToExit: "按 Esc 退出",
	annotationPlaceholder: "这里要怎么改？",
	circleNote: "圈选备注",
	deleteCircle: "删除圈选",
	overallRequest: "总要求",
	sendChanges: "一次修改",
	captureFailed: "没能从预览里采集圈选区域，请刷新预览后重试。",
	previewEmpty: "这个文件夹还没有页面。在左边对 AI 说，比如“做一个咖啡店的落地页”。",
	previewInstalling: "正在安装依赖…",
	previewStarting: "正在启动页面…",
	previewError: "页面启动失败",
	previewStopped: "页面服务已停止",

	devRunning: "页面运行中",
	devInstalling: "正在安装依赖",
	devStarting: "正在启动页面",
	devError: "页面启动失败",
	devStopped: "页面服务已停止",
	devEmpty: "还没有页面",
	noProject: "未打开项目",
	sessionIdle: "AI 空闲",
	sessionBusy: "AI 处理中…",
	disconnected: "与 s-ui 的连接已断开，请重新启动后刷新页面。",
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

/** 失败原因的本地化文案：已知错误码用字典，其余显示后台原文。 */
export function errorText(t: T, error: { code?: string; message: string }) {
	return (error.code && t.errors[error.code]) || error.message;
}

export function useI18n() {
	const [locale, setLocale] = useState(initialLocale);
	useEffect(() => {
		document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
	}, [locale]);
	const toggle = useCallback(() => {
		setLocale((current) => {
			const next = current === "zh" ? "en" : "zh";
			localStorage.setItem(STORAGE_KEY, next);
			return next;
		});
	}, []);
	return { t: MESSAGES[locale], locale, toggle };
}
