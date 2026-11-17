// 识别预览页面里实际存在的组件（在用户的预览页面里执行，经预览桥接脚本调用）。
// 契约（冻结）：这里导出的类型；识别函数待补（TODO），实现时与 page-capture.ts 一样保持自包含。

/** 能识别的组件类别。 */
export type ComponentKind = "button" | "link" | "input" | "card" | "nav" | "heading" | "image" | "list" | "badge" | "table" | "dialog" | "footer";

/** 一类组件在当前页面里的情况。 */
export type FoundComponent = {
	kind: ComponentKind;
	/** 页面里这一类的实例数。 */
	count: number;
	/** 代表实例的选择器（唯一定位一个元素，可交给 AI 或做高亮）。 */
	selector: string;
	/** 尽量能选中这一类全部实例的选择器（优先共享 class），用于临时样式层覆盖。 */
	groupSelector: string;
	/** 代表实例的文字（截断），便于在面板里认出是哪个。 */
	text: string;
	/** 代表实例的关键计算样式：color、backgroundColor、borderRadius、padding、fontFamily、fontSize、fontWeight、boxShadow、border。 */
	styles: Record<string, string>;
};

export type PageInspection = {
	/** 识别时预览页面的地址。 */
	url: string;
	/** 按数量从多到少。 */
	components: FoundComponent[];
	/** 页面上实际用到的字体（计算后的 font-family，按使用多少排序）。 */
	fonts: string[];
	/** 页面上用得最多的颜色（文字与背景，rgb 字符串，按使用多少排序）。 */
	colors: string[];
};
