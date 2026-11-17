// 工具窗面板契约（冻结）：左侧工具窗条上的每个面板（组件库、参考页面……）都是一个 PanelDefinition，
// 只通过 PanelProps 与工作台交互。改这里的类型会同时影响所有面板，需要先和各面板负责人对齐。
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { ImageAttachment, ModuleApi } from "../../server/protocol.ts";
import type { Locale } from "./i18n.ts";

export type { ImageAttachment, Locale, ModuleApi };

/** 当前打开的项目。工具窗只在打开项目后出现，所以总是有值。 */
export type ProjectInfo = {
	/** 项目文件夹绝对路径。 */
	dir: string;
	/** 文件夹名，用作项目名。 */
	name: string;
	/** 预览页面地址（经 s-ui 转发）；页面还没跑起来时为空。 */
	previewUrl?: string;
};

/** 用户在预览上圈中的一个元素（来自用户此刻看到的真实页面）。 */
export type SelectedElement = { selector: string; text: string; html: string };

/** 当前的圈选上下文：用户在预览里画了圈、还没发出时存在。 */
export type Selection = { elements: SelectedElement[] };

/** 交给 AI 的一条用户消息。 */
export type AiSubmission = {
	/** 消息正文，会显示在对话里。 */
	text: string;
	/** 随消息附带的图片（base64 + mimeType），例如参考页面截图。 */
	images?: ImageAttachment[];
	/** 为 true 且当前有圈选时，附带圈注截图和圈内元素（与在预览里画圈后发送完全相同）；发出后圈选清空。 */
	withSelection?: boolean;
};

/** 调用后台模块（server/modules/<module>.ts）的一个动作；结果类型由该模块的 Api 类型决定。 */
export type CallModule = <Api extends ModuleApi, A extends keyof Api & string>(
	module: string,
	action: A,
	payload: Api[A]["payload"],
	options?: { onProgress?: (data: unknown) => void },
) => Promise<Api[A]["result"]>;

export type PanelProps = {
	/** 当前界面语言；面板用它从自己的 strings.ts 取文案。 */
	locale: Locale;
	project: ProjectInfo;
	selection?: Selection;
	/** AI 是否正在处理（此时提交会排在当前任务之后）。 */
	busy: boolean;
	/** 交给 AI 的统一入口：消息进入同一个对话，用户在对话工具窗里看到它和 AI 的回复。 */
	submitToAi: (submission: AiSubmission) => void;
	/** 切到对话工具窗，通常在 submitToAi 之后调用，让用户看到 AI 的回复。 */
	showChat: () => void;
	callModule: CallModule;
};

export type PanelDefinition = {
	/** 稳定的标识，用于工具窗切换。 */
	id: string;
	icon: LucideIcon;
	/** 工具窗条上的名字（也是面板的可访问名称）。 */
	title: (locale: Locale) => string;
	Component: ComponentType<PanelProps>;
};
