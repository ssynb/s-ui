// 工具窗面板契约（冻结）：左侧工具窗条上的每个面板（打磨、参考页面……）都是一个 PanelDefinition，
// 只通过 PanelProps 与工作台交互。改这里的类型会同时影响所有面板，需要先和各面板负责人对齐。
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { OrganizeProgress, OrganizeResult, PolishApi, PolishStatus } from "../../server/modules/polish.ts";
import type { ComponentKind, FoundComponent, PageInspection } from "../../server/page-inspect.ts";
import type { ImageAttachment, ModuleApi } from "../../server/protocol.ts";
import type { Locale } from "./i18n.ts";
import type { TokenValues } from "../../server/design-tokens.ts";

export { DESIGN_TOKENS, TOKENS_FILE, type TokenGroup, type TokenName, type TokenValues } from "../../server/design-tokens.ts";
export type { ComponentKind, FoundComponent, ImageAttachment, Locale, ModuleApi, OrganizeProgress, OrganizeResult, PageInspection, PolishApi, PolishStatus };

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

/**
 * 操作当前预览页面，立即生效、不改源码、不经 AI。
 * 临时样式层与字体只存在于预览里：页面刷新或热更新后由工作台自动重新注入，直到 clearLayer / clearAll；
 * 圈选采集的是用户看到的页面，所以包含这些临时样式。预览未就绪时各方法失败。
 */
export type PreviewControl = {
	/** 预览页面已跑起来且可以操作。 */
	ready: boolean;
	/** 注入或替换一层临时样式（按 id；后注入的层在上面，覆盖页面自身样式）。 */
	applyLayer: (id: string, css: string) => Promise<void>;
	clearLayer: (id: string) => Promise<void>;
	/** 清掉全部临时样式层和 loadFonts 加载的字体。 */
	clearAll: () => Promise<void>;
	/** 加载网页字体样式表（如 Google Fonts 的 css2 地址），之后样式层里即可使用这些字体。 */
	loadFonts: (stylesheetUrls: string[]) => Promise<void>;
	/** 识别页面里实际存在的组件、字体与颜色。 */
	inspect: () => Promise<PageInspection>;
	/** 读页面上当前生效的设计变量（含临时样式层的覆盖），未定义的变量不出现。 */
	readTokens: () => Promise<TokenValues>;
};

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
	preview: PreviewControl;
};

/**
 * 参考页面工作者导出、供其他面板嵌入的部件（web/src/references/SimilarProducts.tsx）：
 * 同类产品参考，与「参考页面」工具窗共用同一项目的查找结果（不重复查找），compact 时适合放进窄栏。
 */
export type SimilarProductsProps = { panel: PanelProps; compact?: boolean };

/**
 * 空项目（预览状态 empty）时预览区显示的部件（web/src/references/StartFromReference.tsx），由工作台在预览区渲染。
 * defaultMessage 是框架原来的空状态提示。
 */
export type StartFromReferenceProps = { panel: PanelProps; defaultMessage: string };

export type PanelDefinition = {
	/** 稳定的标识，用于工具窗切换。 */
	id: string;
	icon: LucideIcon;
	/** 工具窗条上的名字（也是面板的可访问名称）。 */
	title: (locale: Locale) => string;
	Component: ComponentType<PanelProps>;
};
