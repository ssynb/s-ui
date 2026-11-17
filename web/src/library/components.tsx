import { Check, CircleCheck, FolderOpen, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { ms, pick, useIndicator, vars } from "./kit.tsx";
import { color, duration, easeName, easing, n, radius, range, s, SPRING } from "./params.ts";
import type { DemoProps, Entry, ParamValues, Text } from "./types.ts";

// 常用产品组件：每类 3–4 种明显不同的做法，并排比较。

/** 按做法取描述：每种做法一句外观，再接全类共有的行为。 */
function byVariant(looks: Record<string, (p: ParamValues) => Text>, common: (p: ParamValues) => Text) {
	return (p: ParamValues, variant: string): Text => {
		const look = looks[variant]?.(p) ?? { zh: "", en: "" };
		const rest = common(p);
		return { zh: `${look.zh}；${rest.zh}`, en: `${look.en}; ${rest.en}` };
	};
}

const timing = (p: ParamValues) => ({ zh: `${n(p, "duration")}ms，${easeName(s(p, "easing")).zh}`, en: `${n(p, "duration")}ms, ${easeName(s(p, "easing")).en.toLowerCase()}` });

/** 演示里的“保存”触发按钮。 */
function TriggerButton({ locale, onClick }: { locale: DemoProps["locale"]; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} className="inline-flex h-7 items-center rounded-md bg-panel px-3 ring-1 ring-line ring-inset hover:bg-hover">
			{pick(locale, "保存", "Save")}
		</button>
	);
}

/** 到时自动收起的提示开关。 */
function useFlash(stay: number) {
	const [on, setOn] = useState(false);
	const timer = useRef(0);
	const show = () => {
		setOn(true);
		clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setOn(false), stay);
	};
	return [on, show] as const;
}

function ButtonDemo({ p, variant, slow, locale }: DemoProps) {
	const [busy, setBusy] = useState(false);
	const style = vars({ "--r": `${n(p, "radius")}px`, "--c": s(p, "color"), "--s": n(p, "scale") / 100, "--d": ms(n(p, "duration"), slow), "--e": s(p, "easing") });
	const cls = `lib-pb lib-pb-${variant}`;
	return (
		<div className="grid justify-items-center gap-2">
			<button
				type="button"
				aria-busy={busy}
				className={cls}
				style={style}
				onClick={() => {
					setBusy(true);
					setTimeout(() => setBusy(false), 1200 * slow);
				}}
			>
				{busy ? <span className="lib-spin block size-3.5 rounded-full border-2 border-current border-t-transparent" /> : pick(locale, "继续", "Continue")}
			</button>
			<button type="button" disabled className={cls} style={style}>
				{pick(locale, "不可用", "Disabled")}
			</button>
		</div>
	);
}

function InputDemo({ p, variant, slow, locale }: DemoProps) {
	const [error, setError] = useState(false);
	const style = vars({ "--r": `${n(p, "radius")}px`, "--c": s(p, "color"), "--d": ms(n(p, "duration"), slow), "--e": "cubic-bezier(.2,.8,.2,1)" });
	const label = pick(locale, "邮箱", "Email");
	const field = {
		"aria-invalid": error,
		onChange: () => setError(false),
		onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && setError(!e.currentTarget.value),
		className: `lib-in lib-in-${variant === "floating" ? "filled" : variant}`,
	};
	return (
		<div className="grid w-full max-w-48 gap-1" style={style}>
			{variant === "floating" ? (
				<div className="lib-float">
					<input {...field} placeholder=" " />
					<label>{label}</label>
				</div>
			) : (
				<label className="grid gap-1 text-xs text-muted">
					{label}
					<input {...field} placeholder="name@example.com" />
				</label>
			)}
			<span className={`text-xs ${error ? "text-danger" : "text-faint"}`}>{error ? pick(locale, "请填写邮箱", "Email is required") : pick(locale, "留空按回车看报错", "Press Enter empty to see the error")}</span>
		</div>
	);
}

const SWITCH_SIZES = {
	ios: { w: 44, h: 26, knob: 22 },
	compact: { w: 32, h: 18, knob: 14 },
	icon: { w: 44, h: 26, knob: 22 },
	labeled: { w: 58, h: 26, knob: 22 },
} as const;

function SwitchDemo({ p, variant, slow, locale }: DemoProps) {
	const [on, setOn] = useState(variant === "icon");
	const size = SWITCH_SIZES[variant as keyof typeof SWITCH_SIZES];
	const d = ms(n(p, "duration"), slow);
	const inset = (size.h - size.knob) / 2;
	const label = pick(locale, "邮件通知", "Email alerts");
	return (
		<label className="flex items-center gap-2.5">
			{label}
			<button
				type="button"
				role="switch"
				aria-checked={on}
				aria-label={label}
				onClick={() => setOn(!on)}
				className="relative shrink-0 rounded-full"
				style={{ width: size.w, height: size.h, background: on ? s(p, "color") : "color-mix(in oklab, var(--fg) 18%, transparent)", transition: `background-color ${d}` }}
			>
				{variant === "labeled" && (
					<span className="absolute inset-y-0 grid place-items-center text-[11px] font-semibold text-white" style={on ? { left: 8 } : { right: 7, color: "var(--muted)" }}>
						{on ? pick(locale, "开", "ON") : pick(locale, "关", "OFF")}
					</span>
				)}
				<span
					className="absolute grid place-items-center rounded-full bg-white shadow"
					style={{ top: inset, left: inset, width: size.knob, height: size.knob, transform: on ? `translateX(${size.w - size.knob - inset * 2}px)` : "none", transition: `transform ${d} ${s(p, "easing")}` }}
				>
					{variant === "icon" && (on ? <Check size={12} strokeWidth={3} style={{ color: s(p, "color") }} /> : <X size={12} strokeWidth={3} className="text-faint" />)}
				</span>
			</button>
		</label>
	);
}

function TabsDemo({ p, variant, slow, locale }: DemoProps) {
	const labels = locale === "zh" ? ["全部", "进行", "完成"] : ["All", "Open", "Done"];
	const [active, setActive] = useState(0);
	const { box, ref } = useIndicator(active, locale);
	const d = ms(n(p, "duration"), slow);
	const c = s(p, "color");
	const slide = { left: box.left, width: box.width, transition: `left ${d} ${s(p, "easing")}, width ${d} ${s(p, "easing")}` };
	const tab = (label: string, i: number, className: string, style?: React.CSSProperties) => (
		<button key={label} ref={ref(i)} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={`relative px-2.5 whitespace-nowrap ${className}`} style={{ transition: `color ${d}, background-color ${d}`, ...style }}>
			{label}
		</button>
	);
	if (variant === "segmented")
		return (
			<div role="tablist" className="relative flex rounded-lg bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] p-0.5">
				<span aria-hidden className="absolute top-0.5 bottom-0.5 rounded-md bg-panel shadow-sm ring-1 ring-line" style={slide} />
				{labels.map((l, i) => tab(l, i, `h-7 ${i === active ? "text-fg" : "text-muted"}`))}
			</div>
		);
	if (variant === "underline")
		return (
			<div role="tablist" className="relative flex border-b border-line">
				<span aria-hidden className="absolute -bottom-px h-0.5 rounded-full" style={{ ...slide, background: c }} />
				{labels.map((l, i) => tab(l, i, `h-8`, { color: i === active ? c : "var(--muted)" }))}
			</div>
		);
	if (variant === "pills")
		return (
			<div role="tablist" className="flex gap-1">
				{labels.map((l, i) =>
					tab(l, i, "h-7 rounded-full", i === active ? { background: `color-mix(in oklab, ${c} 14%, transparent)`, color: c } : { color: "var(--muted)" }),
				)}
			</div>
		);
	return (
		<div className="w-full max-w-52">
			<div role="tablist" className="flex">
				{labels.map((l, i) =>
					tab(l, i, `-mb-px h-7 rounded-t-md border ${i === active ? "border-line border-b-panel bg-panel text-fg" : "border-transparent text-muted"}`),
				)}
			</div>
			<div className="h-10 rounded-tr-md rounded-b-md border border-line bg-panel px-3 py-2 text-xs text-muted">{labels[active]}</div>
		</div>
	);
}

function CardDemo({ p, variant, slow, locale }: DemoProps) {
	const style = vars({ "--r": `${n(p, "radius")}px`, "--c": s(p, "color"), "--d": ms(n(p, "duration"), slow), "--e": "cubic-bezier(.2,.8,.2,1)", "--l": "3px", "--a": 0.12 });
	const cls = variant === "lift" ? "lib-lift" : `lib-card-${variant}`;
	return (
		<button type="button" className={`lib-card ${cls} grid w-full max-w-44 gap-1 p-3 text-left`} style={style}>
			<span className="font-semibold">{pick(locale, "季度报告", "Q3 report")}</span>
			<span className="text-xs text-muted">{pick(locale, "3 分钟前更新", "Updated 3 min ago")}</span>
			<span className="mt-1.5 h-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]">
				<span className="block h-full w-2/3 rounded-full" style={{ background: s(p, "color") }} />
			</span>
		</button>
	);
}

function ToastDemo({ p, variant, slow, locale }: DemoProps) {
	const [on, show] = useFlash(n(p, "stay") * slow);
	const d = ms(n(p, "duration"), slow);
	const e = s(p, "easing");
	const saved = pick(locale, "已保存", "Saved");
	if (variant === "inline")
		return (
			<button
				type="button"
				onClick={show}
				className="inline-flex h-7 min-w-24 items-center justify-center gap-1.5 rounded-md px-3 ring-1 ring-line ring-inset"
				style={{ color: on ? "var(--success)" : "var(--fg)", background: on ? "color-mix(in oklab, var(--success) 10%, transparent)" : "var(--panel)", transition: `color ${d}, background-color ${d}` }}
			>
				{on && <Check size={14} />}
				{on ? saved : pick(locale, "保存", "Save")}
			</button>
		);
	const shown = { opacity: on ? 1 : 0, transition: `transform ${d} ${e}, opacity ${d}` };
	return (
		<>
			<TriggerButton locale={locale} onClick={show} />
			{variant === "pill" && (
				<div role="status" className="absolute bottom-3 left-1/2 rounded-full bg-fg px-3 py-1 text-xs text-app" style={{ ...shown, transform: `translate(-50%, ${on ? 0 : 36}px)` }}>
					{saved}
				</div>
			)}
			{variant === "card" && (
				<div role="status" className="absolute top-2 right-2 flex w-36 gap-2 rounded-lg bg-raised p-2 text-xs shadow-lg ring-1 ring-line" style={{ ...shown, transform: on ? "none" : "translateX(calc(100% + 12px))" }}>
					<CircleCheck size={14} className="mt-px shrink-0 text-success" />
					<span>
						<b className="block font-semibold">{saved}</b>
						<span className="text-muted">{pick(locale, "改动已同步", "Changes synced")}</span>
					</span>
				</div>
			)}
			{variant === "banner" && (
				<div role="status" className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-[color-mix(in_oklab,var(--success)_14%,var(--panel))] px-3 py-1.5 text-xs text-success" style={{ ...shown, transform: on ? "none" : "translateY(-100%)" }}>
					<CircleCheck size={14} />
					{pick(locale, "已保存，所有人都能看到最新版本", "Saved. Everyone now sees the latest version")}
				</div>
			)}
		</>
	);
}

function EmptyDemo({ p, variant, locale }: DemoProps) {
	const c = s(p, "color");
	const r = `${n(p, "radius")}px`;
	const [over, setOver] = useState(false);
	const cta = (
		<button type="button" className="inline-flex h-7 items-center gap-1 px-3 text-white hover:brightness-110" style={{ background: c, borderRadius: r }}>
			<Plus size={14} />
			{pick(locale, "新建项目", "New project")}
		</button>
	);
	if (variant === "guided")
		return (
			<div className="grid justify-items-center gap-1.5 text-center">
				<span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] text-muted">
					<FolderOpen size={18} />
				</span>
				<b className="font-semibold">{pick(locale, "还没有项目", "No projects yet")}</b>
				<span className="text-xs text-muted">{pick(locale, "新建一个，做好后会出现在这里", "Create one and it will show up here")}</span>
				{cta}
			</div>
		);
	if (variant === "minimal")
		return (
			<p className="text-muted">
				{pick(locale, "还没有项目。", "No projects yet. ")}
				<button type="button" className="underline underline-offset-2 hover:opacity-80" style={{ color: c }}>
					{pick(locale, "新建一个", "Create one")}
				</button>
			</p>
		);
	if (variant === "dropzone")
		return (
			<button
				type="button"
				onDragEnter={() => setOver(true)}
				onDragLeave={() => setOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setOver(false);
				}}
				onDragOver={(e) => e.preventDefault()}
				className="grid h-[85%] w-[88%] place-content-center justify-items-center gap-1 border-2 border-dashed text-xs text-muted transition-colors hover:text-fg"
				style={{ borderRadius: r, borderColor: over ? c : "var(--line)", background: over ? `color-mix(in oklab, ${c} 8%, transparent)` : "transparent" }}
			>
				<Upload size={18} />
				{pick(locale, "把文件拖到这里，或点击选择", "Drop files here, or click to choose")}
			</button>
		);
	return (
		<div className="relative grid w-[88%] gap-1.5">
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex items-center gap-2 opacity-60">
					<span className="size-6 shrink-0 bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" style={{ borderRadius: r }} />
					<span className="h-2 flex-1 rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" style={{ maxWidth: `${80 - i * 18}%` }} />
				</div>
			))}
			<div className="absolute inset-0 grid place-items-center bg-[linear-gradient(transparent,var(--app)_70%)]">{cta}</div>
		</div>
	);
}

function LoadingDemo({ p, variant, slow, locale }: DemoProps) {
	const c = s(p, "color");
	const period = n(p, "period") * slow;
	const style = vars({ "--p": `${period}ms`, "--c": c });
	const label = pick(locale, "正在思考…", "Thinking…");
	if (variant === "spinner")
		return (
			<span role="status" className="flex items-center gap-2 text-muted" style={style}>
				<span className="lib-spin block size-4 rounded-full border-2 border-t-transparent" style={{ borderColor: c, borderTopColor: "transparent" }} />
				{label}
			</span>
		);
	if (variant === "dots")
		return (
			<span role="status" aria-label={label} className="flex gap-1.5" style={style}>
				{[0, 1, 2].map((i) => (
					<span key={i} className="lib-dot block size-2 rounded-full" style={{ background: c, animationDelay: `${(i * period) / 6}ms` }} />
				))}
			</span>
		);
	if (variant === "shimmer")
		return (
			<span role="status" className="lib-sheen lib-sheen-text" style={style}>
				{label}
			</span>
		);
	return <span role="progressbar" aria-label={label} className="lib-bar relative block h-1 w-[70%] overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" style={style} />;
}

const v = (id: string, zh: string, en: string) => ({ id, name: { zh, en } });

export const COMPONENT_ENTRIES: Entry[] = [
	{
		id: "button",
		category: "button",
		name: { zh: "按钮", en: "Button" },
		summary: { zh: "同一个按钮的四种分量：从最显眼到最低调", en: "Four weights for the same button, from loudest to quietest" },
		variants: [v("solid", "实底", "Solid"), v("soft", "柔和底", "Soft / tonal"), v("outline", "描边", "Outline"), v("raised", "立体光泽", "Raised / glossy")],
		params: [radius(8, 16), color(), range("scale", { zh: "按下时大小", en: "Pressed size" }, 90, 100, 1, "%", 97), duration(140), easing()],
		describe: byVariant(
			{
				solid: (p) => ({ zh: `实底按钮：底色 ${s(p, "color")}、白字，悬停略提亮`, en: `Solid button: ${s(p, "color")} fill with white text, slightly lighter on hover` }),
				soft: (p) => ({ zh: `柔和底按钮：底色是 ${s(p, "color")} 的 14% 浅色、文字用 ${s(p, "color")}，悬停底色加深`, en: `Soft button: ${s(p, "color")} at 14% as the fill with ${s(p, "color")} text, fill deepens on hover` }),
				outline: () => ({ zh: "描边按钮：透明底、1px 中性灰描边、正文色文字，悬停铺一层浅灰", en: "Outline button: transparent fill, 1px neutral border, body-color text, faint gray fill on hover" }),
				raised: (p) => ({ zh: `立体按钮：${s(p, "color")} 由浅到深的竖向渐变、顶部 1px 内高光、细描边和小阴影，悬停略提亮`, en: `Raised button: vertical gradient of ${s(p, "color")} from light to dark, 1px inner top highlight, thin border and small shadow, slightly brighter on hover` }),
			},
			(p) => ({
				zh: `圆角 ${n(p, "radius")}px${n(p, "radius") >= 16 ? "（胶囊形）" : ""}、高 32px；按下缩到 ${n(p, "scale")}%（${timing(p).zh}）；键盘聚焦显示 2px 光环；加载时文字换成转圈且宽度不变`,
				en: `${n(p, "radius")}px corners${n(p, "radius") >= 16 ? " (pill)" : ""}, 32px tall; shrinks to ${n(p, "scale")}% when pressed (${timing(p).en}); 2px ring on keyboard focus; while loading the label becomes a spinner without changing width`,
			}),
		),
		states: { zh: "默认、悬停、按下、键盘聚焦、禁用（变淡）、加载", en: "default, hover, pressed, keyboard focus, disabled (dimmed), loading" },
		Demo: ButtonDemo,
	},
	{
		id: "input",
		category: "input",
		name: { zh: "输入框", en: "Text input" },
		summary: { zh: "描边、填充、下划线、浮动标签四种输入框，留空回车看出错的样子", en: "Outline, filled, underline and floating-label inputs; press Enter while empty to see the error state" },
		variants: [v("outline", "描边", "Outline"), v("filled", "填充底", "Filled"), v("underline", "下划线", "Underline"), v("floating", "浮动标签", "Floating label")],
		params: [radius(8, 16), color(undefined, "color", { zh: "聚焦颜色", en: "Focus color" }), duration(150)],
		describe: byVariant(
			{
				outline: (p) => ({ zh: `描边输入框：1px 中性灰描边，悬停描边加深，聚焦时描边变 ${s(p, "color")} 并外加 3px 浅色光晕`, en: `Outline input: 1px neutral border that darkens on hover; on focus the border turns ${s(p, "color")} with a soft 3px halo` }),
				filled: (p) => ({ zh: `填充输入框：浅灰底、无描边，聚焦时底色变白并出现 2px ${s(p, "color")} 描边`, en: `Filled input: light gray fill without border; on focus the fill turns white with a 2px ${s(p, "color")} border` }),
				underline: (p) => ({ zh: `下划线输入框：只有底部一条线，聚焦时线变 ${s(p, "color")} 并加粗`, en: `Underline input: only a bottom line, which turns ${s(p, "color")} and thicker on focus` }),
				floating: (p) => ({ zh: `浮动标签输入框：标签空着时在框里当占位，聚焦或有内容时缩小移到框上沿并变 ${s(p, "color")}`, en: `Floating-label input: the label sits inside while empty and shrinks up to the top edge, turning ${s(p, "color")}, on focus or once filled` }),
			},
			(p) => ({
				zh: `圆角 ${n(p, "radius")}px、高 32px；状态变化过渡 ${n(p, "duration")}ms；校验失败时边框变红，错误文字留在框下方，不用弹窗`,
				en: `${n(p, "radius")}px corners, 32px tall; state changes animate over ${n(p, "duration")}ms; on validation errors the border turns red and the error text stays below the field, no popups`,
			}),
		),
		states: { zh: "默认、悬停、聚焦、已填、错误、禁用；标签始终可见", en: "default, hover, focus, filled, error, disabled; the label stays visible" },
		Demo: InputDemo,
	},
	{
		id: "switch",
		category: "switch",
		name: { zh: "开关", en: "Switch" },
		summary: { zh: "同一个开关的四种长相，点一下看圆点怎么滑", en: "Four looks for the same switch; click to watch the knob slide" },
		variants: [v("ios", "经典回弹", "Classic springy"), v("compact", "紧凑", "Compact"), v("icon", "带图标", "With icon"), v("labeled", "带开/关字样", "With ON/OFF text")],
		params: [color(), duration(220), easing(SPRING)],
		describe: byVariant(
			{
				ios: () => ({ zh: "经典开关：44×26 的胶囊轨道、22px 白色圆点带阴影", en: "Classic switch: 44×26 pill track with a 22px white knob and shadow" }),
				compact: () => ({ zh: "紧凑开关：32×18 的小轨道、14px 圆点，适合密集的设置列表", en: "Compact switch: 32×18 track with a 14px knob, for dense settings lists" }),
				icon: () => ({ zh: "带图标开关：圆点里开时显示 ✓、关时显示 ×", en: "Switch with icon: the knob shows ✓ when on and × when off" }),
				labeled: () => ({ zh: "带字开关：轨道上空出的一侧写“开/关”", en: "Labeled switch: the free side of the track reads ON/OFF" }),
			},
			(p) => ({
				zh: `开时轨道变 ${s(p, "color")}，圆点滑过去（${timing(p).zh}）；点击整行文字也能切换；开就是终态，不再弹提示`,
				en: `When on, the track turns ${s(p, "color")} and the knob slides across (${timing(p).en}); clicking the label text toggles too; the new position is the feedback, no extra toast`,
			}),
		),
		states: { zh: "开、关、悬停、键盘聚焦、禁用", en: "on, off, hover, keyboard focus, disabled" },
		Demo: SwitchDemo,
	},
	{
		id: "tabs",
		category: "tabs",
		name: { zh: "标签页 / 分段控件", en: "Tabs / segmented control" },
		summary: { zh: "切换同一组内容的四种做法", en: "Four ways to switch between views of the same content" },
		variants: [v("segmented", "分段滑块", "Segmented"), v("underline", "下划线", "Underline"), v("pills", "胶囊", "Pills"), v("enclosed", "文件夹式", "Enclosed")],
		params: [color(), duration(220), easing()],
		describe: byVariant(
			{
				segmented: () => ({ zh: "分段控件：浅灰底槽里一块浮起的选中块（浅色模式为白色），切换时选中块滑到新选项", en: "Segmented control: a raised highlight (white in light mode) inside a light gray track that slides to the new option" }),
				underline: (p) => ({ zh: `下划线标签：选中项文字变 ${s(p, "color")}，底部 2px 指示线滑到新选项并随文字宽度伸缩`, en: `Underline tabs: the active label turns ${s(p, "color")} and a 2px indicator slides under it, resizing to the label width` }),
				pills: (p) => ({ zh: `胶囊标签：每项是独立胶囊，选中项铺 ${s(p, "color")} 的浅色底、文字同色`, en: `Pill tabs: separate pills; the active one gets a light ${s(p, "color")} fill with matching text` }),
				enclosed: () => ({ zh: "文件夹式标签：选中项有描边并和下方内容区连成一体", en: "Enclosed tabs: the active tab is outlined and merges with the content panel below" }),
			},
			(p) => ({
				zh: `切换过渡 ${timing(p).zh}；点当前项不变化；左右方向键可在各项间移动`,
				en: `switching animates over ${timing(p).en}; clicking the current tab does nothing; arrow keys move between tabs`,
			}),
		),
		states: { zh: "选中、未选中、悬停、键盘聚焦", en: "selected, unselected, hover, keyboard focus" },
		Demo: TabsDemo,
	},
	{
		id: "card",
		category: "card",
		name: { zh: "卡片", en: "Card" },
		summary: { zh: "可点的卡片怎么和背景分开：描边、阴影、抬起、底色", en: "How a clickable card separates from the page: border, shadow, lift or tint" },
		variants: [v("border", "细描边", "Border"), v("shadow", "阴影描边", "Shadow border"), v("lift", "悬停抬起", "Lift on hover"), v("tinted", "浅色底", "Tinted")],
		params: [radius(12, 24), color(), duration(180)],
		describe: byVariant(
			{
				border: () => ({ zh: "细描边卡片：1px 中性浅灰描边、无阴影，悬停描边加深", en: "Border card: 1px light neutral border, no shadow, border darkens on hover" }),
				shadow: () => ({ zh: "阴影描边卡片：半透明 1px 环加两层很淡的阴影，悬停略加深；深色模式只留一圈淡白描边", en: "Shadow-border card: translucent 1px ring plus two very faint shadows, slightly deeper on hover; in dark mode just a faint white ring" }),
				lift: () => ({ zh: "悬停抬起卡片：悬停时上浮 3px、阴影变深，按下时下沉回去", en: "Lift card: floats up 3px with a deeper shadow on hover and sinks back when pressed" }),
				tinted: (p) => ({ zh: `浅色底卡片：用 ${s(p, "color")} 的 8% 浅色铺底、无描边，悬停底色略深`, en: `Tinted card: ${s(p, "color")} at 8% as the fill with no border, slightly deeper on hover` }),
			},
			(p) => ({
				zh: `圆角 ${n(p, "radius")}px（里面元素的圆角更小）；悬停变化 ${n(p, "duration")}ms；整张卡可点，键盘可聚焦`,
				en: `${n(p, "radius")}px corners (inner elements use smaller radii); hover changes take ${n(p, "duration")}ms; the whole card is clickable and keyboard-focusable`,
			}),
		),
		states: { zh: "默认、悬停、按下、键盘聚焦", en: "default, hover, pressed, keyboard focus" },
		Demo: CardDemo,
	},
	{
		id: "toast",
		category: "toast",
		name: { zh: "轻提示", en: "Toast / feedback" },
		summary: { zh: "保存成功之后怎么告诉用户：四种反馈位置与分量", en: "Four ways to say “saved”, from a floating pill to changing the button itself" },
		variants: [v("pill", "底部胶囊", "Bottom pill"), v("card", "右上卡片", "Corner card"), v("banner", "顶部横幅", "Top banner"), v("inline", "按钮内反馈", "Inline on the button")],
		params: [duration(240), easing(), range("stay", { zh: "停留", en: "Stays for" }, 1000, 5000, 500, "ms", 2000)],
		describe: byVariant(
			{
				pill: () => ({ zh: "底部胶囊：深色小胶囊从底部浮上来，一句“已保存”", en: "Bottom pill: a small dark pill floats up from the bottom saying “Saved”" }),
				card: () => ({ zh: "右上卡片：带绿色对勾、标题和一句说明的小卡片从右侧滑入", en: "Corner card: a small card with a green check, title and one-line detail slides in from the right" }),
				banner: () => ({ zh: "顶部横幅：整条浅绿横幅从顶部滑下，写清结果和影响", en: "Top banner: a full-width light green bar slides down from the top, stating the result and its effect" }),
				inline: () => ({ zh: "按钮内反馈：不弹任何东西，按钮文字直接变成绿色的“✓ 已保存”，过后恢复", en: "Inline feedback: nothing pops up; the button label itself turns into a green “✓ Saved”, then reverts" }),
			},
			(p) => ({
				zh: `出现 ${timing(p).zh}，停留 ${n(p, "stay") / 1000} 秒后自动消失；连续触发时重新计时，不叠多个`,
				en: `appears over ${timing(p).en}, stays ${n(p, "stay") / 1000}s, then leaves on its own; repeated triggers restart the timer instead of stacking`,
			}),
		),
		states: { zh: "出现、停留、离开；读屏软件能读到结果", en: "enter, stay, leave; screen readers announce the result" },
		stageHeight: 130,
		Demo: ToastDemo,
	},
	{
		id: "empty",
		category: "empty",
		name: { zh: "空状态", en: "Empty state" },
		summary: { zh: "还没有内容时这块显示什么", en: "What an area shows before it has any content" },
		variants: [v("guided", "居中引导", "Guided"), v("minimal", "一句话", "One line"), v("dropzone", "拖放区", "Drop zone"), v("ghost", "虚影预告", "Ghost preview")],
		params: [color(), radius(8, 16)],
		describe: byVariant(
			{
				guided: (p) => ({ zh: `居中引导：圆形浅灰底里一个线性图标，下面一句“还没有项目”、一句下一步说明和一个 ${s(p, "color")} 的“新建项目”按钮`, en: `Guided: a line icon in a light gray circle, then “No projects yet”, one sentence on what to do next, and a ${s(p, "color")} “New project” button` }),
				minimal: (p) => ({ zh: `一句话：灰色正文“还没有项目。”后面跟一个 ${s(p, "color")} 的下划线链接“新建一个”`, en: `One line: gray text “No projects yet.” followed by a ${s(p, "color")} underlined link “Create one”` }),
				dropzone: (p) => ({ zh: `拖放区：虚线框加上传图标和“把文件拖到这里，或点击选择”，拖进来时虚线和底色变成 ${s(p, "color")}`, en: `Drop zone: dashed box with an upload icon and “Drop files here, or click to choose”; while dragging over, border and fill turn ${s(p, "color")}` }),
				ghost: (p) => ({ zh: `虚影预告：几行半透明的列表占位暗示将来的样子，上面渐隐盖一个 ${s(p, "color")} 的“新建项目”按钮`, en: `Ghost preview: a few translucent placeholder rows hint at the future list, fading under a ${s(p, "color")} “New project” button` }),
			},
			(p) => ({
				zh: `圆角 ${n(p, "radius")}px；文案说清“还没有什么”和“怎么开始”；搜索、筛选这类依赖内容的控件等有内容后再出现`,
				en: `${n(p, "radius")}px corners; the copy says what is missing and how to start; controls that need content (search, filters) appear only once there is content`,
			}),
		),
		states: { zh: "空、加载中（留白，不显示空态）、加载失败（单独提示并可重试）", en: "empty, loading (blank, not the empty state), failed (separate message with retry)" },
		stageHeight: 160,
		Demo: EmptyDemo,
	},
	{
		id: "loading",
		category: "loading",
		name: { zh: "加载 / 思考态", en: "Loading / thinking" },
		summary: { zh: "等待时用什么告诉用户“正在进行”", en: "How to say “working on it” while waiting" },
		variants: [v("spinner", "转圈", "Spinner"), v("dots", "三点跳动", "Bouncing dots"), v("shimmer", "扫光文字", "Shimmer text"), v("bar", "进度条", "Indeterminate bar")],
		params: [range("period", { zh: "一轮用时", en: "Cycle time" }, 400, 3000, 100, "ms", 1000), color()],
		describe: byVariant(
			{
				spinner: (p) => ({ zh: `转圈：16px 的 ${s(p, "color")} 圆环缺一角匀速旋转，旁边写“正在思考…”`, en: `Spinner: a 16px ${s(p, "color")} ring with a gap spinning at constant speed next to “Thinking…”` }),
				dots: (p) => ({ zh: `三点跳动：三个 ${s(p, "color")} 小圆点依次上跳并变亮`, en: `Bouncing dots: three ${s(p, "color")} dots hop up and brighten one after another` }),
				shimmer: () => ({ zh: "扫光文字：“正在思考…”灰字上有一道亮光缓慢扫过", en: "Shimmer text: a highlight sweeps slowly across gray “Thinking…” text" }),
				bar: (p) => ({ zh: `进度条：细长灰轨道里一段 ${s(p, "color")} 色块来回穿过，表示进度未知`, en: `Indeterminate bar: a ${s(p, "color")} segment keeps sliding through a thin gray track, meaning progress is unknown` }),
			},
			(p) => ({
				zh: `一轮 ${n(p, "period") / 1000} 秒；完成后立刻换成结果，不留残影；减弱动态时改成静态文字“正在思考…”`,
				en: `one cycle every ${n(p, "period") / 1000}s; replaced by the result as soon as it is ready; with reduced motion show static “Thinking…” text instead`,
			}),
		),
		states: { zh: "进行中、完成、失败", en: "in progress, done, failed" },
		Demo: LoadingDemo,
	},
];
