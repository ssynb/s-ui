import type { Locale } from "../i18n.ts";

// 按页面类型整理的优质页面。全部是无需登录即可打开的公开页面（2026-11 实测）；截图在用户打开该类时按需拍，不随仓库分发。
type Text = Record<Locale, string>;
export type CuratedPage = { name: string; url: string; why: Text };
export type CuratedCategory = { id: string; title: Text; pages: CuratedPage[] };

export const CURATED: CuratedCategory[] = [
	{
		id: "saas-home",
		title: { en: "SaaS home", zh: "SaaS 首页" },
		pages: [
			{ name: "Linear", url: "https://linear.app", why: { en: "Dark, precise hero with the real product UI as the focal point", zh: "深色克制的首屏，用真实产品界面做焦点" } },
			{ name: "Stripe", url: "https://stripe.com", why: { en: "Bold gradient hero, dense yet readable sections", zh: "大胆的渐变首屏，信息密集但层次清晰" } },
			{ name: "Vercel", url: "https://vercel.com", why: { en: "Monochrome, grid-based layout with sharp type", zh: "黑白网格版式，字体锐利" } },
			{ name: "Notion", url: "https://www.notion.com", why: { en: "Friendly illustrations and calm, generous spacing", zh: "亲和的插画，舒展的留白" } },
			{ name: "Raycast", url: "https://www.raycast.com", why: { en: "Striking dark hero with a single strong visual", zh: "深色首屏，一个强烈的视觉焦点" } },
			{ name: "Supabase", url: "https://supabase.com", why: { en: "Developer-focused, clear feature grid on dark", zh: "面向开发者，深色背景上清楚的功能网格" } },
		],
	},
	{
		id: "pricing",
		title: { en: "Pricing", zh: "定价页" },
		pages: [
			{ name: "Linear", url: "https://linear.app/pricing", why: { en: "Four plans side by side, easy to scan", zh: "四档并排，一眼看完" } },
			{ name: "Vercel", url: "https://vercel.com/pricing", why: { en: "Three plans with a clear recommended tier", zh: "三档方案，推荐档突出" } },
			{ name: "Notion", url: "https://www.notion.com/pricing", why: { en: "Monthly/yearly switch and playful highlights", zh: "按月/按年切换，点缀活泼" } },
			{ name: "Figma", url: "https://www.figma.com/pricing", why: { en: "Per-seat pricing explained compactly", zh: "按席位计价讲得紧凑清楚" } },
			{ name: "GitHub", url: "https://github.com/pricing", why: { en: "Feature comparison that stays readable", zh: "功能对比多但依然好读" } },
			{ name: "Raycast", url: "https://www.raycast.com/pricing", why: { en: "Dark pricing cards with strong contrast", zh: "深色定价卡片，对比强烈" } },
		],
	},
	{
		id: "ai-chat",
		title: { en: "AI chat", zh: "AI 对话产品" },
		pages: [
			{ name: "ChatGPT", url: "https://chatgpt.com", why: { en: "Minimal composer-first layout with a quiet sidebar", zh: "以输入框为中心的极简布局，侧栏安静" } },
			{ name: "Gemini", url: "https://gemini.google.com", why: { en: "Soft greeting and suggestion chips", zh: "柔和的问候语和建议入口" } },
			{ name: "Perplexity", url: "https://www.perplexity.ai", why: { en: "Search-like prompt box with mode switches", zh: "搜索式输入框，带模式切换" } },
			{ name: "Kimi", url: "https://www.kimi.com", why: { en: "Clean Chinese-first chat home with quick actions", zh: "中文优先的简洁首页，带快捷功能" } },
			{ name: "Qwen Chat", url: "https://chat.qwen.ai", why: { en: "Centered prompt with model picker in the header", zh: "居中输入框，模型切换在顶栏" } },
			{ name: "Grok", url: "https://grok.com", why: { en: "Monochrome, very sparse chat entry", zh: "黑白配色、极度留白的对话入口" } },
		],
	},
	{
		id: "settings",
		title: { en: "Settings", zh: "设置页" },
		pages: [
			{ name: "Shadcn Admin · Profile", url: "https://shadcn-admin.netlify.app/settings", why: { en: "Side navigation with simple labeled forms", zh: "侧边导航配简洁的表单" } },
			{ name: "Shadcn Admin · Appearance", url: "https://shadcn-admin.netlify.app/settings/appearance", why: { en: "Theme choice shown as visual previews", zh: "主题选择用可视化预览呈现" } },
			{ name: "Shadcn Admin · Notifications", url: "https://shadcn-admin.netlify.app/settings/notifications", why: { en: "Grouped toggles with clear descriptions", zh: "分组开关，说明清楚" } },
			{ name: "Tremor · General", url: "https://dashboard.tremor.so/settings/general", why: { en: "Two-column settings sections with tabs", zh: "带标签页的两栏设置分区" } },
			{ name: "Tremor · Billing", url: "https://dashboard.tremor.so/settings/billing", why: { en: "Usage meters and plan details in one view", zh: "用量条和方案详情集中一页" } },
			{ name: "TailAdmin · Profile", url: "https://demo.tailadmin.com/profile", why: { en: "Profile cards with inline edit actions", zh: "资料卡片，编辑入口就在旁边" } },
		],
	},
	{
		id: "dashboard",
		title: { en: "Dashboard", zh: "仪表盘" },
		pages: [
			{ name: "Shadcn Admin", url: "https://shadcn-admin.netlify.app", why: { en: "KPI cards, chart and recent activity, all neutral", zh: "指标卡、图表、最近动态，整体中性克制" } },
			{ name: "Tremor Dashboard", url: "https://dashboard.tremor.so", why: { en: "Dense metrics with small, crisp charts", zh: "高密度指标，小而清晰的图表" } },
			{ name: "Tremor · Details", url: "https://dashboard.tremor.so/details", why: { en: "Data table with filters and status badges", zh: "带筛选和状态标记的数据表" } },
			{ name: "TailAdmin", url: "https://demo.tailadmin.com", why: { en: "Colorful e-commerce dashboard with a rich sidebar", zh: "色彩更丰富的电商仪表盘，侧栏完整" } },
			{ name: "shadcn/ui", url: "https://ui.shadcn.com/examples/dashboard", why: { en: "Reference component styling for app dashboards", zh: "应用仪表盘的标准组件风格" } },
		],
	},
	{
		id: "portfolio",
		title: { en: "Portfolio", zh: "作品集 / 个人站" },
		pages: [
			{ name: "Brittany Chiang", url: "https://brittanychiang.com", why: { en: "Two-column layout with sticky intro and rich hover", zh: "两栏布局，简介固定，悬停细节丰富" } },
			{ name: "Rauno Freiberg", url: "https://rauno.me", why: { en: "Playful, interaction-led personal site", zh: "以交互取胜、有趣的个人站" } },
			{ name: "Paco Coursey", url: "https://paco.me", why: { en: "Tiny type, lots of white space, pure content", zh: "小字号、大留白，只有内容" } },
			{ name: "Lee Robinson", url: "https://leerob.com", why: { en: "Text-first page with a serif voice", zh: "以文字为主，衬线体有个性" } },
			{ name: "Emil Kowalski", url: "https://emilkowal.ski", why: { en: "Quiet list layout with careful details", zh: "安静的列表式布局，细节考究" } },
			{ name: "Josh W. Comeau", url: "https://www.joshwcomeau.com", why: { en: "Whimsical illustration and colorful accents", zh: "俏皮插画和鲜明的点缀色" } },
		],
	},
	{
		id: "product-detail",
		title: { en: "Product detail", zh: "电商详情" },
		pages: [
			{ name: "Allbirds", url: "https://www.allbirds.com/products/mens-tree-runners", why: { en: "Large product photos, swatches and size picker", zh: "大图、颜色色块和尺码选择" } },
			{ name: "Bellroy", url: "https://www.bellroy.com/products/slim-sleeve-wallet", why: { en: "Clean gallery with material options", zh: "干净的图集和材质选项" } },
			{ name: "Glossier", url: "https://www.glossier.com/products/boy-brow", why: { en: "Soft brand color with a split image/details layout", zh: "柔和品牌色，图文左右分栏" } },
			{ name: "Apple · AirPods Pro", url: "https://www.apple.com/airpods-pro/", why: { en: "Cinematic product hero and sticky buy bar", zh: "电影感的产品首屏，购买条常驻" } },
			{ name: "Herman Miller · Aeron", url: "https://www.hermanmiller.com/products/seating/office-chairs/aeron-chairs/", why: { en: "Premium furniture detail with tabs for specs", zh: "高端家具详情，规格分标签页" } },
			{ name: "Nothing · Phone (3)", url: "https://us.nothing.tech/products/phone-3", why: { en: "Distinctive dot-matrix brand language", zh: "点阵字体的独特品牌语言" } },
		],
	},
];
