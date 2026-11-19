const en = {
	intro: "Choose a real reference, then try its typography, spacing and surfaces on this page. Source files stay unchanged until you confirm.",
	choose: "Choose for style preview", preview: "Preview on this page", generating: "Preparing preview…",
	confirm: "Confirm and ask AI to edit source", cancel: "Cancel and restore", change: "Choose another reference",
	unavailable: "Open a running page to try a style.", trial: "Preview only · source unchanged",
	notice: "This tries styles on your existing content, not a copy of the reference layout. AI will implement the confirmed direction; pixel-perfect matching is not guaranteed.",
	changed: "The page changed. Choose a reference and generate a new preview.", failed: "Style preview failed", working: "Restoring preview…",
};
const zh: typeof en = {
	intro: "选一张真实参考，在当前页面试排版、间距与表面样式。明确确认后才交给 AI 改源码。",
	choose: "选作风格参考", preview: "在当前页面预览", generating: "正在生成预览…",
	confirm: "确认并让 AI 改源码", cancel: "取消并还原", change: "换一张参考",
	unavailable: "打开可运行的页面后才能试用风格。", trial: "仅预览 · 未改源码",
	notice: "在现有内容上试样式，不复制参考页结构。确认后由 AI 实现这个方向，不保证逐像素一致。",
	changed: "页面已变化，请重新选择参考并生成预览。", failed: "风格预览失败", working: "正在还原预览…",
};
export const STRINGS = { en, zh };
