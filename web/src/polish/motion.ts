import type { ComponentKind, FoundComponent } from "../panels.ts";
import { rule, styleContext } from "./components.ts";
import { duration, EASE_OUT, easing, n, range, s, timing } from "./params.ts";
import { defaults, type ParamSpec, type ParamValues, type Text } from "./types.ts";

// 可以直接在页面组件上试的动效（源自原组件库的动效词典）。每个效果生成一层只作用于该组件组的临时样式。

export type MotionEffect = {
	id: string;
	name: Text;
	summary: Text;
	/** 能用在哪些组件上。 */
	kinds: ComponentKind[];
	params: ParamSpec[];
	/** 一次性播放的效果（进场、抖动）：试用时可以重播。 */
	replayable?: boolean;
	/** run 用来重播：换一个关键帧名字，浏览器就会重新播放。 */
	css: (sel: string, p: ParamValues, ctx: { primary: string; run: number; kind: ComponentKind }) => string[];
	describe: (p: ParamValues) => Text;
	states: Text;
};

const pct = (key: string, zh: string, en: string, min: number, max: number, value: number) => range(key, { zh, en }, min, max, 1, "%", value);
const px = (key: string, zh: string, en: string, min: number, max: number, value: number) => range(key, { zh, en }, min, max, 1, "px", value);
const ms = (p: ParamValues, key = "duration") => `${n(p, key)}ms`;

export const MOTION_EFFECTS: MotionEffect[] = [
	{
		id: "press",
		name: { zh: "按压缩放", en: "Press / scale down" },
		summary: { zh: "按下时轻微缩小，松手恢复", en: "Shrinks slightly while pressed" },
		kinds: ["button", "card", "link"],
		params: [pct("scale", "按下时大小", "Pressed size", 85, 99, 96), duration(140), easing()],
		css: (sel, p) => [rule(sel, { transition: `transform ${ms(p)} ${s(p, "easing")}` }), rule(`${sel}:active`, { transform: `scale(${n(p, "scale") / 100})` })],
		describe: (p) => ({
			zh: `按下时缩到 ${n(p, "scale")}% 左右，松手立刻恢复（${timing(p).zh}），不要位移`,
			en: `Shrinks to about ${n(p, "scale")}% while pressed and returns on release (${timing(p).en}); no movement`,
		}),
		states: { zh: "默认、按下（缩小）、松开（恢复）、禁用时不缩放", en: "default, pressed (shrunk), released (restored), no scaling when disabled" },
	},
	{
		id: "hover-brighten",
		name: { zh: "悬停提亮", en: "Hover brighten" },
		summary: { zh: "鼠标指上去略微变亮", en: "Gets slightly brighter under the pointer" },
		kinds: ["button", "image"],
		params: [pct("amount", "提亮幅度", "Brightness", 102, 125, 108), duration(160)],
		css: (sel, p) => [rule(sel, { transition: `filter ${ms(p)}` }), rule(`${sel}:hover`, { filter: `brightness(${n(p, "amount") / 100})` })],
		describe: (p) => ({
			zh: `悬停时亮度提高到 ${n(p, "amount")}%（${n(p, "duration")}ms 渐变），不改颜色、不放大`,
			en: `On hover, brightness rises to ${n(p, "amount")}% (${n(p, "duration")}ms fade); no color change, no scaling`,
		}),
		states: { zh: "默认、悬停、按下、键盘聚焦", en: "default, hover, pressed, keyboard focus" },
	},
	{
		id: "hover-veil",
		name: { zh: "悬停面纱", en: "Hover state" },
		summary: { zh: "鼠标指上去出现淡灰底", en: "A faint tint appears under the pointer" },
		kinds: ["link", "nav", "list"],
		params: [pct("intensity", "底色深浅", "Tint strength", 2, 20, 6), duration(160)],
		css: (sel, p, c) => {
			// 导航栏和列表铺在里面的每一项上，而不是整块
			const target = c.kind === "link" ? sel : `${sel} :is(a, li)`;
			return [
				rule(target, { transition: `background-color ${ms(p)}`, "border-radius": "6px" }),
				rule(`${target}:hover`, { "background-color": `color-mix(in oklab, currentColor ${n(p, "intensity")}%, transparent)` }),
			];
		},
		describe: (p) => ({
			zh: `悬停时铺一层很淡的底色（文字色 ${n(p, "intensity")}% 透明度），${n(p, "duration")}ms 渐变；不要变色、不要放大`,
			en: `On hover, lay a faint tint (text color at ${n(p, "intensity")}%), fading in over ${n(p, "duration")}ms; no color change, no scaling`,
		}),
		states: { zh: "默认、悬停（淡底）、按下、键盘聚焦", en: "default, hover (faint tint), pressed, keyboard focus" },
	},
	{
		id: "focus-ring",
		name: { zh: "键盘焦点环", en: "Focus ring" },
		summary: { zh: "用键盘切换时出现一圈主色光环，鼠标点击时不显示（按 Tab 试）", en: "A primary ring on keyboard focus only (press Tab to try)" },
		kinds: ["button", "link", "input"],
		params: [px("width", "环粗细", "Ring width", 1, 4, 2), px("offset", "离元素距离", "Gap from element", 0, 6, 2)],
		css: (sel, p, c) => [rule(`${sel}:focus-visible`, { outline: `${n(p, "width")}px solid ${c.primary}`, "outline-offset": `${n(p, "offset")}px` })],
		describe: (p) => ({
			zh: `键盘聚焦时显示 ${n(p, "width")}px 粗的主色光环，离元素 ${n(p, "offset")}px；鼠标点击时不显示（用 :focus-visible）`,
			en: `On keyboard focus, show a ${n(p, "width")}px primary ring ${n(p, "offset")}px from the element; never on mouse click (use :focus-visible)`,
		}),
		states: { zh: "默认、键盘聚焦（显示光环）、鼠标点击后（不显示）", en: "default, keyboard focus (ring), after mouse click (no ring)" },
	},
	{
		id: "loading",
		name: { zh: "加载中样子", en: "Loading state" },
		summary: { zh: "预览按钮提交中的样子：文字换成转圈，宽度不变", en: "Shows the submitting look: a spinner replaces the label, width unchanged" },
		kinds: ["button"],
		params: [range("period", { zh: "转一圈", en: "Spin time" }, 400, 2000, 50, "ms", 800)],
		css: (sel, p, c) => [
			rule(sel, { position: "relative", color: "transparent", "pointer-events": "none" }),
			rule(`${sel}::after`, {
				content: '""',
				position: "absolute",
				inset: "0",
				margin: "auto",
				width: "1em",
				height: "1em",
				"border-radius": "50%",
				border: "2px solid currentColor",
				"border-color": `color-mix(in oklab, var(--sui-color-primary-contrast, ${c.primary}) 35%, transparent)`,
				"border-top-color": `var(--sui-color-primary-contrast, ${c.primary})`,
				animation: `sui-polish-spin ${ms(p, "period")} linear infinite`,
			}),
			"@keyframes sui-polish-spin { to { rotate: 360deg; } }",
		],
		describe: (p) => ({
			zh: `提交中按钮文字淡出、换成转圈（一圈 ${n(p, "period")}ms），按钮宽度保持不变，期间不能重复点击；完成后换回文字`,
			en: `While submitting, the label fades out for a spinner (${n(p, "period")}ms per turn); the button keeps its width and can't be clicked again; the label returns when done`,
		}),
		states: { zh: "默认、加载中（禁止重复点击）、完成、失败", en: "default, loading (no double submit), done, failed" },
	},
	{
		id: "shake",
		name: { zh: "错误抖动", en: "Shake" },
		summary: { zh: "输入有误时左右晃几下，边框变红", en: "Wiggles and turns red on invalid input" },
		kinds: ["input"],
		replayable: true,
		params: [px("distance", "晃动幅度", "Distance", 2, 12, 6), duration(320)],
		css: (sel, p, c) => {
			const x = n(p, "distance");
			return [
				rule(sel, { "border-color": "#db3b4b", animation: `sui-polish-shake-${c.run} ${ms(p)} both` }),
				`@keyframes sui-polish-shake-${c.run} { 20% { translate: ${-x}px 0; } 40% { translate: ${x * 0.8}px 0; } 60% { translate: ${-x * 0.5}px 0; } 80% { translate: ${x * 0.3}px 0; } }`,
			];
		},
		describe: (p) => ({
			zh: `输入有误时输入框左右轻晃两下（幅度 ${n(p, "distance")}px、共 ${n(p, "duration")}ms），边框变红，错误文字留在下方`,
			en: `On invalid input the field wiggles twice (${n(p, "distance")}px, ${n(p, "duration")}ms), its border turns red, and the error text stays below`,
		}),
		states: { zh: "默认、聚焦、出错（抖动 + 红框 + 错误文字）、改正后恢复", en: "default, focused, error (shake + red border + message), restored after fixing" },
	},
	{
		id: "fade-up",
		name: { zh: "淡入上移", en: "Fade in up" },
		summary: { zh: "出现时从下方升起并变清楚", en: "Rises a little while fading in" },
		kinds: ["card", "heading", "image", "button"],
		replayable: true,
		params: [px("distance", "上移距离", "Rise distance", 0, 40, 12), duration(400), easing()],
		css: (sel, p, c) => [
			rule(sel, { animation: `sui-polish-fade-up-${c.run} ${ms(p)} ${s(p, "easing")} both` }),
			`@keyframes sui-polish-fade-up-${c.run} { from { opacity: 0; translate: 0 ${n(p, "distance")}px; } }`,
		],
		describe: (p) => ({
			zh: `进入页面时从下方 ${n(p, "distance")}px 处淡入上移到位（${timing(p).zh}），首屏已显示过的内容不要重播`,
			en: `On entering, fades in while rising ${n(p, "distance")}px into place (${timing(p).en}); content already shown does not replay`,
		}),
		states: { zh: "出现前（透明、偏下）、出现后（到位）", en: "before entering (transparent, lower), entered (in place)" },
	},
	{
		id: "stagger",
		name: { zh: "依次出现", en: "Staggered entrance" },
		summary: { zh: "列表各项一个接一个淡入", en: "Items fade in one after another" },
		kinds: ["list"],
		replayable: true,
		params: [px("distance", "上移距离", "Rise distance", 0, 24, 8), duration(300), range("gap", { zh: "间隔", en: "Delay between items" }, 20, 200, 10, "ms", 60)],
		css: (sel, p, c) => [
			rule(`${sel} > *`, { animation: `sui-polish-rise-${c.run} ${ms(p)} ${EASE_OUT} both` }),
			...Array.from({ length: 8 }, (_, i) => rule(`${sel} > *:nth-child(${i + 2})`, { "animation-delay": `${(i + 1) * n(p, "gap")}ms` })),
			`@keyframes sui-polish-rise-${c.run} { from { opacity: 0; translate: 0 ${n(p, "distance")}px; } }`,
		],
		describe: (p) => ({
			zh: `列表各项依次从下方 ${n(p, "distance")}px 淡入（每项 ${n(p, "duration")}ms，间隔 ${n(p, "gap")}ms）；新增一项时只播放它自己`,
			en: `List items fade in one by one from ${n(p, "distance")}px below (${n(p, "duration")}ms each, ${n(p, "gap")}ms apart); a newly added item animates alone`,
		}),
		states: { zh: "首次出现、新增一项、删除一项（其余平滑补位）", en: "first appearance, item added, item removed (others close the gap smoothly)" },
	},
	{
		id: "lift",
		name: { zh: "悬停抬起", en: "Lift on hover" },
		summary: { zh: "轻轻上浮、阴影变深，表示可以点", en: "Floats up with a deeper shadow, hinting it's clickable" },
		kinds: ["card", "image"],
		params: [px("lift", "抬起高度", "Lift height", 0, 8, 3), pct("shadow", "阴影深浅", "Shadow strength", 4, 30, 12), duration(200)],
		css: (sel, p) => [
			rule(sel, { transition: `transform ${ms(p)} ${EASE_OUT}, box-shadow ${ms(p)}` }),
			rule(`${sel}:hover`, { transform: `translateY(-${n(p, "lift")}px)`, "box-shadow": `0 ${n(p, "lift") * 3}px ${n(p, "lift") * 8}px rgb(0 0 0 / ${n(p, "shadow") / 100})` }),
			rule(`${sel}:active`, { transform: "translateY(0)" }),
		],
		describe: (p) => ({
			zh: `悬停时上浮 ${n(p, "lift")}px 并加深阴影（不透明度 ${n(p, "shadow")}%），按下时落回（${n(p, "duration")}ms）`,
			en: `On hover, lifts ${n(p, "lift")}px with a deeper shadow (${n(p, "shadow")}% opacity); settles back when pressed (${n(p, "duration")}ms)`,
		}),
		states: { zh: "默认、悬停（抬起）、按下（落回）、键盘聚焦", en: "default, hover (lifted), pressed (settled), keyboard focus" },
	},
	{
		id: "skeleton",
		name: { zh: "骨架占位", en: "Skeleton" },
		summary: { zh: "预览加载中的样子：灰色占位上一道微光扫过", en: "Shows the loading look: gray placeholders with a sweeping light" },
		kinds: ["card", "list"],
		params: [range("period", { zh: "扫一次用时", en: "Sweep period" }, 600, 3000, 100, "ms", 1400)],
		css: (sel, p) => [
			rule(sel, { position: "relative", overflow: "hidden" }),
			rule(`${sel}::after`, {
				content: '""',
				position: "absolute",
				inset: "0",
				"border-radius": "inherit",
				background: "linear-gradient(90deg, rgb(127 127 127 / .14) 30%, rgb(127 127 127 / .26) 50%, rgb(127 127 127 / .14) 70%) var(--sui-color-surface, #fff)",
				"background-size": "300% 100%",
				animation: `sui-polish-sheen ${ms(p, "period")} linear infinite`,
			}),
			"@keyframes sui-polish-sheen { from { background-position: 100% 0; } to { background-position: -100% 0; } }",
		],
		describe: (p) => ({
			zh: `内容没到时用和最终内容同样形状的灰色占位，一道微光每 ${n(p, "period") / 1000} 秒扫过；不要显示“暂无内容”`,
			en: `Before content arrives, show gray placeholders shaped like it with a light sweeping every ${n(p, "period") / 1000}s; never show “No content”`,
		}),
		states: { zh: "加载中（占位 + 微光）、加载完成、加载失败（单独提示）", en: "loading (placeholder + sweep), loaded, failed (separate message)" },
	},
];

export function motionLayer(effect: MotionEffect, found: FoundComponent, params: ParamValues, run = 0) {
	const ctx = styleContext(found);
	return effect.css(ctx.s, { ...defaults(effect.params), ...params }, { primary: ctx.primary, run, kind: found.kind }).join("\n");
}
