import { useEffect, useId, useRef, useState } from "react";
import { ms, pick, Replay, restart, useIndicator, useReducedMotion, vars } from "./kit.tsx";
import { color, duration, EASE_IN, EASE_OUT, easeName, easing, n, range, s, SPRING } from "./params.ts";
import type { DemoProps, Entry } from "./types.ts";

// 动效词典的 23 个效果（来源：用户自己的《动效与细节词典》）。每个条目：可点/可悬停的演示、参数、怎么跟 AI 说。

const pct = (key: string, zh: string, en: string, min: number, max: number, value: number) => range(key, { zh, en }, min, max, 1, "%", value);
const px = (key: string, zh: string, en: string, min: number, max: number, value: number) => range(key, { zh, en }, min, max, 1, "px", value);

/** 时长 + 缓动的口语说法，例：“140ms，先快后慢”。 */
const timing = (p: DemoProps["p"], key = "duration") => ({
	zh: `${n(p, key)}ms，${easeName(p.easing ?? "").zh}`,
	en: `${n(p, key)}ms, ${easeName(p.easing ?? "").en.toLowerCase()}`,
});

function PressDemo({ p, slow, locale }: DemoProps) {
	return (
		<button type="button" className="lib-btn lib-press" style={vars({ "--d": ms(n(p, "duration"), slow), "--e": s(p, "easing"), "--s": n(p, "scale") / 100 })}>
			{pick(locale, "按住我", "Press and hold")}
		</button>
	);
}

function VeilDemo({ p, slow, locale }: DemoProps) {
	return (
		<button type="button" className="lib-btn lib-veil" style={vars({ "--d": ms(n(p, "duration"), slow), "--i": `${n(p, "intensity")}%` })}>
			{pick(locale, "把鼠标移上来", "Hover over me")}
		</button>
	);
}

function FocusDemo({ p, locale }: DemoProps) {
	return (
		<div className="grid justify-items-center gap-2">
			<button type="button" className="lib-btn lib-outline lib-focus" style={vars({ "--w": `${n(p, "width")}px`, "--o": `${n(p, "offset")}px`, "--c": s(p, "color") })}>
				{pick(locale, "键盘聚焦我", "Focus me by keyboard")}
			</button>
			<span className="text-xs text-muted">{pick(locale, "先点这里空白处，再按 Tab", "Click this blank area, then press Tab")}</span>
		</div>
	);
}

const SPIN_MS = 800;

function LoadingDemo({ p, slow, locale }: DemoProps) {
	const [busy, setBusy] = useState(false);
	const d = ms(n(p, "duration"), slow);
	const layer = (on: boolean) => ({ gridArea: "1/1", opacity: on ? 1 : 0, transform: on ? "none" : "scale(.5)", transition: `opacity ${d}, transform ${d} ${s(p, "easing")}` });
	return (
		<button
			type="button"
			aria-busy={busy}
			className="lib-btn grid min-w-28"
			onClick={() => {
				if (busy) return;
				setBusy(true);
				setTimeout(() => setBusy(false), 1600 * slow);
			}}
		>
			<span style={layer(!busy)}>{pick(locale, "提交", "Submit")}</span>
			<span style={layer(busy)} className="grid place-items-center">
				<span className="lib-spin block size-4 rounded-full border-2 border-white/40 border-t-white" style={vars({ "--p": ms(SPIN_MS, slow) })} />
			</span>
		</button>
	);
}

function SwitchDemo({ p, slow, locale }: DemoProps) {
	const [on, setOn] = useState(false);
	const d = ms(n(p, "duration"), slow);
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={pick(locale, "示例开关", "Demo switch")}
			onClick={() => setOn(!on)}
			className="relative h-7 w-[46px] rounded-full"
			style={{ background: on ? s(p, "color") : "color-mix(in oklab, var(--fg) 18%, transparent)", transition: `background-color ${d}` }}
		>
			<span
				className="absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow"
				style={{ transform: on ? "translateX(18px)" : "none", transition: `transform ${d} ${s(p, "easing")}` }}
			/>
		</button>
	);
}

function SegmentDemo({ p, slow, locale }: DemoProps) {
	const labels = locale === "zh" ? ["日", "周", "月"] : ["Day", "Week", "Month"];
	const [active, setActive] = useState(0);
	const { box: knob, ref } = useIndicator(active, locale);
	const d = ms(n(p, "duration"), slow);
	const r = `${n(p, "radius")}px`;
	return (
		<div role="radiogroup" className="relative flex bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] p-1" style={{ borderRadius: `calc(${r} + 4px)` }}>
			<span
				aria-hidden
				className="absolute top-1 bottom-1 bg-panel shadow-sm ring-1 ring-line"
				style={{ ...knob, borderRadius: r, transition: `left ${d} ${s(p, "easing")}, width ${d} ${s(p, "easing")}` }}
			/>
			{labels.map((label, i) => (
				<button
					key={label}
					ref={ref(i)}
					type="button"
					role="radio"
					aria-checked={i === active}
					onClick={() => setActive(i)}
					className={`relative px-4 py-1 ${i === active ? "text-fg" : "text-muted"}`}
				>
					{label}
				</button>
			))}
		</div>
	);
}

function MorphDemo({ p, slow, locale }: DemoProps) {
	const [open, setOpen] = useState(false);
	const d = ms(n(p, "duration"), slow);
	const line = (top: number, transform: string, opacity = 1) => (
		<i className="absolute left-3 h-0.5 w-5 rounded bg-fg" style={{ top, transform, opacity, transition: `transform ${d} ${s(p, "easing")}, opacity ${d}` }} />
	);
	return (
		<button
			type="button"
			aria-label={open ? pick(locale, "关闭菜单", "Close menu") : pick(locale, "打开菜单", "Open menu")}
			aria-expanded={open}
			onClick={() => setOpen(!open)}
			className="relative size-11 rounded-xl bg-panel shadow-sm ring-1 ring-line"
		>
			{line(15, open ? "translateY(6px) rotate(45deg)" : "none")}
			{line(21, "none", open ? 0 : 1)}
			{line(27, open ? "translateY(-6px) rotate(-45deg)" : "none")}
		</button>
	);
}

function ShakeDemo({ p, slow, locale }: DemoProps) {
	const [error, setError] = useState(false);
	const ref = useRef<HTMLInputElement>(null);
	return (
		<div className="grid w-56 gap-1.5">
			<input
				ref={ref}
				aria-invalid={error}
				aria-label={pick(locale, "验证码", "Verification code")}
				placeholder={pick(locale, "留空按回车试试", "Press Enter while empty")}
				onChange={() => setError(false)}
				onKeyDown={(e) => {
					if (e.key !== "Enter") return;
					const el = ref.current!;
					el.classList.remove("lib-shake");
					void el.offsetWidth;
					const empty = !el.value;
					setError(empty);
					if (empty) el.classList.add("lib-shake");
				}}
				className="h-9 rounded-lg bg-panel px-3 ring-1 ring-line outline-none ring-inset placeholder:text-faint focus:ring-accent aria-invalid:ring-danger"
				style={vars({ "--d": ms(n(p, "duration"), slow), "--x": `${n(p, "distance")}px` })}
			/>
			<span className={`text-xs ${error ? "text-danger" : "text-transparent"}`} aria-live="polite">
				{error ? pick(locale, "请输入验证码", "Enter the code") : "\u00a0"}
			</span>
		</div>
	);
}

function FadeUpDemo({ p, slow, locale }: DemoProps) {
	const [on, setOn] = useState(false);
	useEffect(() => restart(setOn), []);
	const d = ms(n(p, "duration"), slow);
	return (
		<>
			<div
				className="size-16 rounded-2xl bg-accent"
				style={{ opacity: on ? 1 : 0, transform: on ? "none" : `translateY(${n(p, "distance")}px)`, transition: on ? `opacity ${d} ${s(p, "easing")}, transform ${d} ${s(p, "easing")}` : "none" }}
			/>
			<Replay locale={locale} onClick={() => restart(setOn)} />
		</>
	);
}

function CurvesDemo({ p, slow, locale }: DemoProps) {
	const [go, setGo] = useState(false);
	const lanes = [s(p, "easing"), s(p, "exitEasing"), "linear", SPRING].filter((v, i, all) => all.indexOf(v) === i);
	return (
		<>
			<div className="grid w-[90%] gap-2">
				{lanes.map((curve) => (
					<div key={curve} className="flex items-center gap-2 text-xs text-muted">
						<span className="w-16 shrink-0 truncate">{easeName(curve)[locale]}</span>
						<i className="relative h-5 flex-1 rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]">
							<b
								className="absolute top-0 size-5 rounded-full bg-accent"
								style={{ left: go ? "calc(100% - 20px)" : 0, transition: `left ${ms(n(p, "duration"), slow)} ${curve}` }}
							/>
						</i>
					</div>
				))}
			</div>
			<Replay locale={locale} label={pick(locale, "播放", "Play")} onClick={() => setGo(!go)} />
		</>
	);
}

function PushDemo({ p, slow, locale }: DemoProps) {
	const [on, setOn] = useState(false);
	const t = `transform ${ms(n(p, "duration"), slow)} ${s(p, "easing")}`;
	const pane = "absolute inset-0 grid place-items-center font-semibold";
	return (
		<button type="button" onClick={() => setOn(!on)} className="relative h-28 w-60 overflow-hidden rounded-xl ring-1 ring-line">
			<span className={`${pane} bg-panel`} style={{ transform: on ? `translateX(-${n(p, "parallax")}%)` : "none", transition: t }}>
				{pick(locale, "列表（点我进入）", "List (click to open)")}
			</span>
			<span className={`${pane} bg-selected ${on ? "shadow-[-8px_0_16px_-12px_rgb(0_0_0/.4)]" : ""}`} style={{ transform: on ? "none" : "translateX(100%)", transition: t }}>
				{pick(locale, "详情（点我返回）", "Detail (click to go back)")}
			</span>
		</button>
	);
}

function ExpandDemo({ p, slow, locale }: DemoProps) {
	const stage = useRef<HTMLDivElement>(null);
	const chip = useRef<HTMLButtonElement>(null);
	const [phase, setPhase] = useState<"closed" | "origin" | "open">("closed");
	const d = n(p, "duration") * slow;
	const origin = () => {
		const c = chip.current!.getBoundingClientRect();
		const o = stage.current!.getBoundingClientRect();
		return { left: c.left - o.left, top: c.top - o.top, width: c.width, height: c.height, opacity: 0 };
	};
	const open = () => {
		setPhase("origin");
		requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
	};
	const close = () => {
		setPhase("origin");
		setTimeout(() => setPhase("closed"), d);
	};
	const box = phase === "open" ? { left: "8%", top: "8%", width: "84%", height: "84%", opacity: 1 } : phase === "origin" ? origin() : undefined;
	const t = ["left", "top", "width", "height", "opacity"].map((k) => `${k} ${d}ms ${s(p, "easing")}`).join(", ");
	return (
		<div ref={stage} className="absolute inset-0 grid place-items-center">
			<button type="button" ref={chip} onClick={open} className="rounded-full bg-panel px-3.5 py-1.5 ring-1 ring-line hover:bg-hover">
				{pick(locale, "文件预览", "File preview")}
			</button>
			{box && (
				<button type="button" onClick={close} className="absolute grid place-items-center overflow-hidden rounded-2xl bg-raised shadow-xl ring-1 ring-line" style={{ ...box, transition: phase === "closed" ? "none" : t }}>
					{pick(locale, "预览面板（点我关闭）", "Preview (click to close)")}
				</button>
			)}
		</div>
	);
}

function AccordionDemo({ p, slow, locale }: DemoProps) {
	const [open, setOpen] = useState(false);
	return (
		<div className="w-60 rounded-xl bg-panel ring-1 ring-line">
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3.5 py-2.5 font-semibold">
				{pick(locale, "展开工作过程", "Show the steps")}
				<span aria-hidden style={{ rotate: open ? "180deg" : "0deg", transition: `rotate ${ms(n(p, "duration"), slow)}` }}>
					▾
				</span>
			</button>
			<div className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows ${ms(n(p, "duration"), slow)} ${s(p, "easing")}` }}>
				<div className="overflow-hidden">
					<p className="px-3.5 pb-3 text-xs text-muted">
						{pick(locale, "读取了说明文件", "Read the instructions")}
						<br />
						{pick(locale, "打开了网页", "Opened the page")}
						<br />
						{pick(locale, "搜索了 3 个关键词", "Searched 3 keywords")}
					</p>
				</div>
			</div>
		</div>
	);
}

function ToastDemo({ p, slow, locale }: DemoProps) {
	const [on, setOn] = useState(false);
	const timer = useRef(0);
	const d = ms(n(p, "duration"), slow);
	return (
		<>
			<button
				type="button"
				className="lib-btn lib-outline"
				onClick={() => {
					setOn(true);
					clearTimeout(timer.current);
					timer.current = window.setTimeout(() => setOn(false), n(p, "stay") * slow);
				}}
			>
				{pick(locale, "保存", "Save")}
			</button>
			<div
				role="status"
				className="absolute bottom-3 left-1/2 rounded-full bg-fg px-3.5 py-1.5 text-xs text-app"
				style={{ opacity: on ? 1 : 0, transform: `translate(-50%, ${on ? 0 : 40}px)`, transition: `transform ${d} ${s(p, "easing")}, opacity ${d}` }}
			>
				{on && pick(locale, "已保存", "Saved")}
			</div>
		</>
	);
}

type Row = { id: number; state: "enter" | "in" | "exit" };

function ListDemo({ p, slow, locale }: DemoProps) {
	const next = useRef(3);
	const [rows, setRows] = useState<Row[]>([
		{ id: 2, state: "in" },
		{ id: 1, state: "in" },
	]);
	const d = n(p, "duration") * slow;
	const add = () => {
		const id = next.current++;
		setRows((r) => [{ id, state: "enter" as const }, ...r].slice(0, 4));
		requestAnimationFrame(() => requestAnimationFrame(() => setRows((r) => r.map((row) => (row.id === id ? { ...row, state: "in" } : row)))));
	};
	const remove = (id: number) => {
		setRows((r) => r.map((row) => (row.id === id ? { ...row, state: "exit" } : row)));
		setTimeout(() => setRows((r) => r.filter((row) => row.id !== id)), d);
	};
	const t = `grid-template-rows ${d}ms ${s(p, "easing")}, opacity ${d}ms, transform ${d}ms ${s(p, "easing")}`;
	return (
		<>
			<div className="flex w-56 flex-col">
				{rows.map((row) => (
					<div
						key={row.id}
						className="grid"
						style={{
							gridTemplateRows: row.state === "in" ? "1fr" : "0fr",
							opacity: row.state === "in" ? 1 : 0,
							transform: row.state === "enter" ? "translateY(-8px)" : row.state === "exit" ? "translateX(16px)" : "none",
							transition: t,
						}}
					>
						<div className="overflow-hidden">
							<button type="button" onClick={() => remove(row.id)} className="mb-1.5 w-full rounded-lg bg-panel px-3 py-1.5 text-left text-xs ring-1 ring-line ring-inset hover:bg-hover">
								{pick(locale, `会话 ${row.id}（点我删除）`, `Chat ${row.id} (click to delete)`)}
							</button>
						</div>
					</div>
				))}
			</div>
			<Replay locale={locale} label={pick(locale, "加一条", "Add one")} onClick={add} />
		</>
	);
}

function LiftDemo({ p, slow, locale }: DemoProps) {
	return (
		<div
			tabIndex={0}
			className="lib-lift grid h-20 w-44 place-items-center rounded-2xl bg-panel"
			style={vars({ "--d": ms(n(p, "duration"), slow), "--e": EASE_OUT, "--l": `${n(p, "lift")}px`, "--a": n(p, "shadow") / 100 })}
		>
			{pick(locale, "把鼠标移上来", "Hover over me")}
		</div>
	);
}

function SkeletonDemo({ p, slow }: DemoProps) {
	const r = `${n(p, "radius")}px`;
	return (
		<div className="grid w-56 gap-2" style={vars({ "--p": ms(n(p, "period"), slow) })}>
			{["90%", "100%", "60%"].map((w) => (
				<i key={w} className="lib-sheen block h-3" style={{ width: w, borderRadius: r }} />
			))}
		</div>
	);
}

function ShimmerDemo({ p, slow, locale }: DemoProps) {
	return (
		<span className="lib-sheen lib-sheen-text text-lg" style={vars({ "--p": ms(n(p, "period"), slow) })}>
			{pick(locale, "正在思考…", "Thinking…")}
		</span>
	);
}

const STREAM_TEXT = {
	zh: "好的，我先看看你的页面结构，再把按钮的按下效果统一改成轻微缩小。",
	en: "Sure, I'll look at your page structure first, then make every button shrink slightly when pressed.",
};

const CARET_BLINK_MS = 1000;

function StreamDemo({ p, slow, locale }: DemoProps) {
	const [count, setCount] = useState(0);
	const [run, setRun] = useState(0);
	const text = STREAM_TEXT[locale];
	const step = n(p, "speed") * slow;
	const reduced = useReducedMotion();
	useEffect(() => {
		if (reduced) return setCount(text.length);
		setCount(0);
		const timer = setInterval(() => setCount((c) => (c >= text.length ? c : c + 1)), step);
		return () => clearInterval(timer);
	}, [run, text, step, reduced]);
	const done = count >= text.length;
	return (
		<>
			<p className="min-h-16 w-[85%]" style={vars({ "--f": ms(n(p, "fade"), slow) })}>
				{[...text.slice(0, count)].map((ch, i) => (
					<span key={i} className="lib-fadein">
						{ch}
					</span>
				))}
				<span className="lib-caret" style={{ ...vars({ "--p": ms(CARET_BLINK_MS, slow) }), opacity: done ? 0 : 1, transition: done ? `opacity ${ms(400, slow)}` : "none", animationPlayState: done ? "paused" : "running" }} />
			</p>
			<Replay locale={locale} onClick={() => setRun(run + 1)} />
		</>
	);
}

const DIGIT_PX = 40;

function NumberDemo({ p, slow, locale }: DemoProps) {
	const [value, setValue] = useState(4647);
	const digits = String(value).padStart(4, "0");
	return (
		<>
			<div className="flex h-10 overflow-hidden text-[40px] leading-10 font-semibold tabular-nums" aria-label={String(value)} role="img">
				{[...digits].map((d, i) => (
					<div
						key={i}
						aria-hidden
						className="flex flex-col"
						style={{ transform: `translateY(${-DIGIT_PX * Number(d)}px)`, transition: `transform ${ms(n(p, "duration"), slow)} ${s(p, "easing")}` }}
					>
						{Array.from({ length: 10 }, (_, k) => (
							<span key={k} className="h-10">
								{k}
							</span>
						))}
					</div>
				))}
			</div>
			<Replay locale={locale} label={pick(locale, "换个数字", "New number")} onClick={() => setValue((v) => Math.min(9999, Math.max(0, v + Math.round((Math.random() - 0.4) * 900))))} />
		</>
	);
}

function BeamDemo({ p, slow, locale }: DemoProps) {
	const [run, setRun] = useState(0);
	const once = p.mode === "once";
	return (
		<>
			<span
				key={run}
				className="lib-beam rounded-full bg-panel px-5 py-3 font-semibold shadow-sm"
				style={vars({ "--p": ms(n(p, "period"), slow), "--c1": s(p, "color"), "--c2": s(p, "color2"), "--n": once ? 1 : "infinite" })}
			>
				{pick(locale, "流光边框", "Border beam")}
			</span>
			{once && <Replay locale={locale} onClick={() => setRun(run + 1)} />}
		</>
	);
}

function GooeyDemo({ p, slow, locale }: DemoProps) {
	const [open, setOpen] = useState(false);
	const filter = useId().replace(/:/g, "");
	const t = `transform ${ms(n(p, "duration"), slow)} ${s(p, "easing")}`;
	const offsets = [
		[-54, -30],
		[0, -44],
		[54, -30],
	] as const;
	return (
		<div className="relative h-28 w-40">
			<svg width="0" height="0" className="absolute">
				<filter id={filter}>
					<feGaussianBlur in="SourceGraphic" stdDeviation={n(p, "blur")} />
					<feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -9" />
				</filter>
			</svg>
			<div className="absolute inset-0" style={{ filter: `url(#${filter})` }}>
				{offsets.map(([x, y]) => (
					<span key={x} className="absolute top-[52px] left-[62px] size-9 rounded-full bg-accent" style={{ transform: open ? `translate(${x}px, ${y}px)` : "none", transition: t }} />
				))}
				<span className="absolute top-[52px] left-[62px] size-9 rounded-full bg-accent" />
			</div>
			<button
				type="button"
				aria-expanded={open}
				aria-label={pick(locale, "更多选项", "More options")}
				onClick={() => setOpen(!open)}
				className="absolute top-[52px] left-[62px] grid size-9 place-items-center text-[22px] text-white"
				style={{ rotate: open ? "45deg" : "0deg", transition: `rotate ${ms(300, slow)}` }}
			>
				+
			</button>
		</div>
	);
}

const SWIPE_PX = 30;

function FanDemo({ p, slow, locale }: DemoProps) {
	const names = locale === "zh" ? ["律师", "会计", "设计", "编程", "运营"] : ["Law", "Tax", "Design", "Code", "Ops"];
	const [active, setActive] = useState(2);
	const swipe = useRef<{ x: number; moved: boolean }>({ x: 0, moved: false });
	const t = `transform ${ms(n(p, "duration"), slow)} ${s(p, "easing")}, opacity ${ms(n(p, "duration"), slow)}`;
	return (
		<div
			className="relative h-32 w-full touch-pan-y select-none"
			onPointerDown={(e) => {
				swipe.current = { x: e.clientX, moved: false };
			}}
			onPointerUp={(e) => {
				const dx = e.clientX - swipe.current.x;
				if (Math.abs(dx) < SWIPE_PX) return;
				swipe.current.moved = true;
				setActive((a) => Math.min(names.length - 1, Math.max(0, a - Math.sign(dx))));
			}}
		>
			{names.map((name, i) => {
				const k = i - active;
				return (
					<button
						key={name}
						type="button"
						aria-current={k === 0 || undefined}
						onClick={() => !swipe.current.moved && setActive(i)}
						className="absolute top-3 left-[calc(50%-28px)] grid h-20 w-14 place-items-center rounded-xl bg-raised text-xs font-semibold shadow-md ring-1 ring-line"
						style={{
							transform: `translateX(${k * n(p, "spread")}px) translateY(${Math.abs(k) * 8}px) rotate(${k * n(p, "angle")}deg) scale(${1 - Math.abs(k) * 0.12})`,
							opacity: 1 - Math.abs(k) * 0.25,
							zIndex: 10 - Math.abs(k),
							transition: t,
						}}
					>
						{name}
					</button>
				);
			})}
		</div>
	);
}

export const MOTION_ENTRIES: Entry[] = [
	{
		id: "press",
		category: "feedback",
		name: { zh: "按压缩放", en: "Press / scale down" },
		summary: { zh: "按下时轻微缩小，松手恢复，告诉你“按到了”", en: "Shrinks slightly while pressed and springs back, so you feel the click" },
		params: [pct("scale", "按下时大小", "Pressed size", 85, 99, 96), duration(140), easing()],
		describe: (p) => ({
			zh: `按钮按下时缩到 ${n(p, "scale")}% 左右，松手立刻恢复（${timing(p).zh}），不要位移`,
			en: `When pressed, the button shrinks to about ${n(p, "scale")}% and returns as soon as it is released (${timing(p).en}); it must not move`,
		}),
		states: { zh: "默认、按下（缩小）、松开（恢复）、禁用时不缩放", en: "default, pressed (shrunk), released (restored), no scaling when disabled" },
		Demo: PressDemo,
	},
	{
		id: "hover-veil",
		category: "feedback",
		name: { zh: "悬停面纱", en: "Hover state" },
		summary: { zh: "鼠标指上去出现淡灰底，文字变深", en: "A faint tint appears under the pointer and the text darkens" },
		params: [pct("intensity", "底色深浅", "Tint strength", 2, 20, 6), duration(160)],
		describe: (p) => ({
			zh: `悬停时铺一层很淡的灰底（文字色 ${n(p, "intensity")}% 透明度），文字变深，${n(p, "duration")}ms 渐变；不要变色、不要放大`,
			en: `On hover, lay a very faint tint (text color at ${n(p, "intensity")}% opacity) and darken the text, fading in over ${n(p, "duration")}ms; no color change, no scaling`,
		}),
		states: { zh: "默认、悬停（淡灰底）、按下、键盘聚焦", en: "default, hover (faint tint), pressed, keyboard focus" },
		Demo: VeilDemo,
	},
	{
		id: "focus-ring",
		category: "feedback",
		name: { zh: "键盘焦点环", en: "Focus ring" },
		summary: { zh: "用键盘切换时外面出现一圈光环，鼠标点击时不显示", en: "A ring appears around the element when reached by keyboard, not on mouse click" },
		params: [px("width", "环粗细", "Ring width", 1, 4, 2), px("offset", "离元素距离", "Gap from element", 0, 6, 3), color()],
		describe: (p) => ({
			zh: `键盘聚焦时显示 ${n(p, "width")}px 粗、颜色 ${s(p, "color")} 的光环，离元素 ${n(p, "offset")}px；鼠标点击时不显示（用 :focus-visible）`,
			en: `When focused by keyboard, show a ${n(p, "width")}px ring in ${s(p, "color")}, ${n(p, "offset")}px away from the element; never on mouse click (use :focus-visible)`,
		}),
		states: { zh: "默认、键盘聚焦（显示光环）、鼠标点击后（不显示光环）", en: "default, keyboard focus (ring shown), after mouse click (no ring)" },
		Demo: FocusDemo,
	},
	{
		id: "loading-handoff",
		category: "feedback",
		name: { zh: "加载交接", en: "Loading state / morph" },
		summary: { zh: "点击后文字淡出、转圈淡入，按钮宽度不变", en: "After clicking, the label fades out and a spinner fades in; the width stays the same" },
		params: [duration(200), easing()],
		describe: (p) => ({
			zh: `提交中文字缩小淡出、转圈放大淡入（${timing(p).zh}），按钮宽度保持不变，不要跳；完成后原路换回文字`,
			en: `While submitting, the label shrinks and fades out while a spinner grows in (${timing(p).en}); the button keeps its width, nothing jumps; reverse when done`,
		}),
		states: { zh: "默认、加载中（禁止重复点击）、完成", en: "default, loading (no double submit), done" },
		Demo: LoadingDemo,
	},
	{
		id: "switch-slide",
		category: "feedback",
		name: { zh: "开关滑动", en: "Switch / toggle" },
		summary: { zh: "圆点滑到另一边，带一点回弹，底色同时变化", en: "The knob slides across with a little bounce while the track changes color" },
		params: [duration(240), easing(SPRING), color()],
		describe: (p) => ({
			zh: `开关的圆点滑过去（${timing(p).zh}），底色同时变成 ${s(p, "color")}；开就是终态，不要再弹提示`,
			en: `The switch knob slides across (${timing(p).en}) while the track turns ${s(p, "color")}; the new position is the feedback, no extra toast`,
		}),
		states: { zh: "关、开、悬停、键盘聚焦、禁用", en: "off, on, hover, keyboard focus, disabled" },
		Demo: SwitchDemo,
	},
	{
		id: "sliding-indicator",
		category: "feedback",
		name: { zh: "滑动选中块", en: "Sliding indicator" },
		summary: { zh: "切换选项时，选中底块从旧位置滑到新位置", en: "When switching options, the highlight slides from the old option to the new one" },
		params: [duration(260), easing(), range("radius", { zh: "圆角", en: "Corner radius" }, 0, 16, 1, "px", 16)],
		describe: (p) => ({
			zh: `切换时选中底块（圆角 ${n(p, "radius")}px）从旧位置滑到新位置，宽度跟着变（${timing(p).zh}），不要瞬间跳`,
			en: `When switching, the highlight (${n(p, "radius")}px corners) slides from the old option to the new one and resizes to fit (${timing(p).en}); never jump`,
		}),
		states: { zh: "选中、未选中、悬停、键盘聚焦", en: "selected, unselected, hover, keyboard focus" },
		Demo: SegmentDemo,
	},
	{
		id: "icon-morph",
		category: "feedback",
		name: { zh: "图标变形", en: "Icon morph" },
		summary: { zh: "图标的线条变成另一个图标，而不是直接替换", en: "The lines of one icon turn into another instead of swapping instantly" },
		params: [duration(260), easing()],
		describe: (p) => ({
			zh: `菜单图标点开后三条线变形成关闭的 ×（${timing(p).zh}），再点原路变回`,
			en: `When the menu opens, its three lines morph into a close × (${timing(p).en}) and morph back when closed`,
		}),
		states: { zh: "收起（菜单图标）、展开（关闭图标）、键盘聚焦", en: "closed (menu icon), open (close icon), keyboard focus" },
		Demo: MorphDemo,
	},
	{
		id: "shake",
		category: "feedback",
		name: { zh: "错误抖动", en: "Shake" },
		summary: { zh: "输入有误时左右晃几下，边框变红", en: "Wiggles side to side and turns red when the input is wrong" },
		params: [px("distance", "晃动幅度", "Distance", 2, 12, 6), duration(320)],
		describe: (p) => ({
			zh: `输入有误时输入框左右轻晃两下（幅度 ${n(p, "distance")}px、共 ${n(p, "duration")}ms），边框变红，错误文字留在下方`,
			en: `On invalid input, the field wiggles left and right twice (${n(p, "distance")}px, ${n(p, "duration")}ms total), its border turns red, and the error text stays below it`,
		}),
		states: { zh: "默认、聚焦、出错（抖动 + 红框 + 错误文字）、改正后恢复", en: "default, focused, error (shake + red border + message), restored after fixing" },
		Demo: ShakeDemo,
	},
	{
		id: "fade-up",
		category: "transition",
		name: { zh: "淡入上移", en: "Fade in up / enter" },
		summary: { zh: "从下方一点点升起并变清楚", en: "Rises a little from below while fading in" },
		params: [px("distance", "上移距离", "Rise distance", 0, 40, 8), duration(240), easing()],
		describe: (p) => ({
			zh: `新内容从下方 ${n(p, "distance")}px 处淡入上移到位（${timing(p).zh}），首屏已有内容不要重播`,
			en: `New content fades in while rising ${n(p, "distance")}px into place (${timing(p).en}); content already on screen does not replay it`,
		}),
		states: { zh: "出现前（透明、偏下）、出现后（到位）；已在屏幕上的内容保持不动", en: "before entering (transparent, lower), entered (in place); content already on screen stays still" },
		Demo: FadeUpDemo,
	},
	{
		id: "easing",
		category: "transition",
		name: { zh: "缓动曲线", en: "Easing / spring" },
		summary: { zh: "同样的距离和时间，手感完全不同", en: "Same distance and time, completely different feel" },
		params: [duration(700), easing(EASE_OUT, "easing", { zh: "出现时", en: "Entering" }), easing(EASE_IN, "exitEasing", { zh: "消失时", en: "Leaving" })],
		describe: (p) => ({
			zh: `出现时用“${easeName(s(p, "easing")).zh}”，消失时用“${easeName(s(p, "exitEasing")).zh}”并比出现更快一点；开关和加号这类小件可以有轻微回弹`,
			en: `Use “${easeName(s(p, "easing")).en}” when things appear and “${easeName(s(p, "exitEasing")).en}” when they leave, leaving a bit faster than entering; small pieces like switches may overshoot slightly`,
		}),
		states: { zh: "出现、消失（比出现更快）", en: "entering, leaving (faster than entering)" },
		Demo: CurvesDemo,
	},
	{
		id: "push",
		category: "transition",
		name: { zh: "推移转场", en: "Push / slide transition" },
		summary: { zh: "新页面从一侧推进来，旧页面被推走，有方向感", en: "The new page pushes in from one side and the old one moves away, giving a sense of direction" },
		params: [duration(320), easing(), pct("parallax", "旧页退出距离", "Old page travel", 0, 100, 30)],
		describe: (p) => ({
			zh: `切换页面时整块推移（${timing(p).zh}）：新页从右侧推入，旧页向左退 ${n(p, "parallax")}%；返回时反方向`,
			en: `Switching pages pushes the whole view (${timing(p).en}): the new page slides in from the right while the old one moves ${n(p, "parallax")}% to the left; going back reverses it`,
		}),
		states: { zh: "前进（新页从右推入）、返回（反方向）", en: "forward (new page pushes in from the right), back (reverse direction)" },
		Demo: PushDemo,
	},
	{
		id: "expand-origin",
		category: "transition",
		name: { zh: "从来源展开", en: "Expand from origin / shared element" },
		summary: { zh: "弹窗从你点的那个东西“长”出来，关闭时缩回原处", en: "The panel grows out of the thing you clicked and shrinks back into it when closed" },
		params: [duration(320), easing()],
		describe: (p) => ({
			zh: `点卡片后，预览从这张卡的位置放大出来（${timing(p).zh}），关闭时缩回去`,
			en: `After clicking a card, the preview grows out of that card's position (${timing(p).en}) and shrinks back into it when closed`,
		}),
		states: { zh: "收起（在来源位置）、展开、关闭（缩回来源）", en: "collapsed (at its origin), expanded, closing (shrinks back to origin)" },
		Demo: ExpandDemo,
	},
	{
		id: "accordion",
		category: "transition",
		name: { zh: "折叠展开", en: "Collapse / accordion" },
		summary: { zh: "下面的内容平滑让出空间，而不是突然弹开", en: "Content below smoothly makes room instead of jumping" },
		params: [duration(260), easing()],
		describe: (p) => ({
			zh: `展开时高度平滑增长（${timing(p).zh}），下方内容跟着让位，箭头同时翻转；收起原路返回，不要跳`,
			en: `When expanding, the height grows smoothly (${timing(p).en}), content below moves along, and the arrow flips; collapsing reverses it, nothing jumps`,
		}),
		states: { zh: "收起、展开（箭头翻转）、键盘可操作", en: "collapsed, expanded (arrow flipped), operable by keyboard" },
		Demo: AccordionDemo,
	},
	{
		id: "toast-motion",
		category: "transition",
		name: { zh: "轻提示", en: "Toast" },
		summary: { zh: "底部短暂浮出一句结果，几秒后自己消失", en: "A short result message floats up at the bottom and leaves on its own" },
		params: [duration(280), easing(), range("stay", { zh: "停留", en: "Stays for" }, 1000, 5000, 500, "ms", 2000)],
		describe: (p) => ({
			zh: `保存成功在底部浮出一句“已保存”（${timing(p).zh}），停留 ${n(p, "stay") / 1000} 秒后淡出`,
			en: `After saving, “Saved” floats up at the bottom (${timing(p).en}), stays ${n(p, "stay") / 1000}s, then fades out`,
		}),
		states: { zh: "出现、停留、离开；连续触发重新计时", en: "enter, stay, leave; repeated triggers restart the timer" },
		Demo: ToastDemo,
	},
	{
		id: "list-motion",
		category: "transition",
		name: { zh: "列表增删", en: "List enter / exit / reorder" },
		summary: { zh: "新项淡入，删掉的项滑走，其余项平滑补位", en: "New rows fade in, deleted rows slide away, the rest close the gap smoothly" },
		params: [duration(220), easing()],
		describe: (p) => ({
			zh: `新项出现在顶部时轻微淡入，其他行平滑下移；删除的行向右滑出淡出，下面的行平滑补位（${timing(p).zh}）`,
			en: `A new row fades in at the top while the others slide down smoothly; a deleted row slides right and fades out while the rows below close the gap (${timing(p).en})`,
		}),
		stageHeight: 160,
		states: { zh: "新增（顶部淡入）、删除（滑出淡出）、其余行补位", en: "added (fades in at top), removed (slides and fades out), remaining rows close the gap" },
		Demo: ListDemo,
	},
	{
		id: "lift",
		category: "transition",
		name: { zh: "悬停抬起", en: "Lift / elevation" },
		summary: { zh: "卡片轻轻上浮，阴影变深，表示可以点", en: "The card floats up a little with a deeper shadow, hinting it is clickable" },
		params: [px("lift", "抬起高度", "Lift height", 0, 8, 3), pct("shadow", "阴影深浅", "Shadow strength", 4, 30, 12), duration(200)],
		describe: (p) => ({
			zh: `卡片悬停时抬起 ${n(p, "lift")}px 并加深阴影（不透明度 ${n(p, "shadow")}%），按下时下沉 1px（${n(p, "duration")}ms）`,
			en: `On hover the card lifts ${n(p, "lift")}px with a deeper shadow (${n(p, "shadow")}% opacity); pressing sinks it 1px (${n(p, "duration")}ms)`,
		}),
		states: { zh: "默认、悬停（抬起）、按下（下沉）、键盘聚焦", en: "default, hover (lifted), pressed (sunk), keyboard focus" },
		Demo: LiftDemo,
	},
	{
		id: "skeleton",
		category: "waiting",
		name: { zh: "骨架屏", en: "Skeleton / shimmer" },
		summary: { zh: "内容还没到时先画出灰色形状，一道微光扫过", en: "Gray shapes stand in for content that hasn't arrived, with a light sweeping across" },
		params: [range("period", { zh: "扫一次用时", en: "Sweep period" }, 600, 3000, 100, "ms", 1400), range("radius", { zh: "圆角", en: "Corner radius" }, 0, 12, 1, "px", 6)],
		describe: (p) => ({
			zh: `加载时用和最终内容同样形状的灰色占位（圆角 ${n(p, "radius")}px），一道微光每 ${n(p, "period") / 1000} 秒扫过一次；不要显示“暂无内容”`,
			en: `While loading, show gray placeholders shaped like the final content (${n(p, "radius")}px corners) with a light sweeping across every ${n(p, "period") / 1000}s; never show “No content”`,
		}),
		states: { zh: "加载中（占位 + 微光）、加载完成（换成真实内容）、加载失败（单独提示）", en: "loading (placeholders + sweep), loaded (real content), failed (separate message)" },
		Demo: SkeletonDemo,
	},
	{
		id: "shimmer-text",
		category: "waiting",
		name: { zh: "扫光文字", en: "Shimmer text" },
		summary: { zh: "一段亮光从文字上扫过，表示“正在进行”", en: "A highlight sweeps across text to say “in progress”" },
		params: [range("period", { zh: "扫一次用时", en: "Sweep period" }, 800, 4000, 100, "ms", 2400)],
		describe: (p) => ({
			zh: `运行中的那一行文字加缓慢扫光（每 ${n(p, "period") / 1000} 秒一次），完成后变成静态灰字`,
			en: `The line that is running gets a slow shimmer (one sweep every ${n(p, "period") / 1000}s) and turns into static gray text when done`,
		}),
		states: { zh: "进行中（扫光）、完成（静态灰字）", en: "in progress (shimmer), done (static gray text)" },
		Demo: ShimmerDemo,
	},
	{
		id: "streaming",
		category: "waiting",
		name: { zh: "流式逐字", en: "Streaming / typewriter + caret" },
		summary: { zh: "回答一个字一个字出现，末尾有光标，写完光标淡出", en: "The answer appears character by character with a caret that fades when done" },
		params: [range("speed", { zh: "每字间隔", en: "Per character" }, 20, 200, 5, "ms", 60), range("fade", { zh: "单字淡入", en: "Character fade" }, 0, 600, 10, "ms", 250)],
		describe: (p) => ({
			zh: `回答逐字淡入（每字约 ${n(p, "speed")}ms，单字淡入 ${n(p, "fade")}ms），末尾跟一个闪烁光标，写完后光标淡出`,
			en: `The answer appears character by character (about ${n(p, "speed")}ms each, each fading in over ${n(p, "fade")}ms) with a blinking caret at the end that fades out when done`,
		}),
		states: { zh: "输出中（逐字 + 光标）、输出完成（光标淡出）", en: "streaming (characters + caret), finished (caret fades out)" },
		Demo: StreamDemo,
	},
	{
		id: "rolling-number",
		category: "waiting",
		name: { zh: "数字滚动", en: "Rolling number / odometer" },
		summary: { zh: "数字变化时每一位像里程表一样滚动", en: "Each digit rolls like an odometer when the number changes" },
		params: [duration(500), easing(SPRING)],
		describe: (p) => ({
			zh: `数字变化时每一位上下滚动到新值（${timing(p).zh}），等宽数字不抖动；拖动滑块这类连续变化时直接跟手`,
			en: `When the number changes, each digit rolls to its new value (${timing(p).en}) using tabular digits so nothing wobbles; follow continuous input such as sliders directly`,
		}),
		states: { zh: "数字变大、变小（各位按方向滚动）、连续拖动（直接跟手）", en: "value up, value down (digits roll accordingly), continuous drag (follows directly)" },
		Demo: NumberDemo,
	},
	{
		id: "border-beam",
		category: "waiting",
		name: { zh: "流光边框", en: "Border beam" },
		summary: { zh: "一道彩色光沿着边框跑", en: "A colored light runs along the border" },
		params: [
			range("period", { zh: "一圈用时", en: "Lap time" }, 800, 6000, 100, "ms", 2400),
			color("#a855f7", "color", { zh: "颜色 1", en: "Color 1" }),
			color("#3574f0", "color2", { zh: "颜色 2", en: "Color 2" }),
			{
				key: "mode",
				label: { zh: "播放", en: "Plays" },
				kind: "select",
				default: "once",
				options: [
					{ value: "once", label: { zh: "跑一圈后停下", en: "One lap, then stops" } },
					{ value: "loop", label: { zh: "一直循环", en: "Loops forever" } },
				],
			},
		],
		describe: (p) => ({
			zh: `这个按钮边缘跑一圈彩色流光（${s(p, "color")} → ${s(p, "color2")}，一圈 ${n(p, "period") / 1000} 秒），${p.mode === "once" ? "跑一圈后停下" : "一直循环"}`,
			en: `A colored beam runs around this button's border (${s(p, "color")} → ${s(p, "color2")}, ${n(p, "period") / 1000}s per lap), ${p.mode === "once" ? "stopping after one lap" : "looping forever"}`,
		}),
		states: { zh: "流光进行中、停止后（普通边框）", en: "beam running, stopped (plain border)" },
		Demo: BeamDemo,
	},
	{
		id: "gooey",
		category: "personality",
		name: { zh: "液态融合", en: "Gooey / liquid morph" },
		summary: { zh: "几个圆像水滴一样从一个点分开、再融回去", en: "Circles split from one point like droplets and merge back" },
		params: [duration(420), easing(SPRING), px("blur", "粘稠度", "Gooeyness", 4, 12, 8)],
		describe: (p) => ({
			zh: `点加号后三个选项像液体一样从加号里分裂出来（${timing(p).zh}，粘稠度 ${n(p, "blur")}），收起时融回去；每屏最多一个这样的动效`,
			en: `Tapping the plus splits three options out of it like liquid (${timing(p).en}, gooeyness ${n(p, "blur")}) and merges them back on close; at most one effect like this per screen`,
		}),
		states: { zh: "收起（融为一个加号）、展开（分裂成选项）、键盘聚焦", en: "closed (merged into the plus), open (split into options), keyboard focus" },
		Demo: GooeyDemo,
	},
	{
		id: "fan",
		category: "personality",
		name: { zh: "扇形舞台", en: "Fan / cover flow" },
		summary: { zh: "中间那张放大，两侧旋转、变小、变淡；点两侧的卡换到中间", en: "The center card is largest, the sides tilt, shrink and fade; click a side card to bring it to the center" },
		params: [duration(380), easing(), range("angle", { zh: "倾斜角度", en: "Tilt" }, 0, 20, 1, "°", 10), px("spread", "卡片间距", "Spacing", 30, 80, 52)],
		describe: (p) => ({
			zh: `卡片排成扇形，中间那张放大，两侧每张倾斜 ${n(p, "angle")}°、变小变淡，间距 ${n(p, "spread")}px；点两侧的卡换到中间（${timing(p).zh}），可左右滑动`,
			en: `Cards form a fan: the center one is largest, each side card tilts ${n(p, "angle")}°, shrinks and fades, ${n(p, "spread")}px apart; clicking a side card brings it to the center (${timing(p).en}), swiping works too`,
		}),
		states: { zh: "中间（放大）、两侧（倾斜变淡）、切换中", en: "center (enlarged), sides (tilted and faded), switching" },
		Demo: FanDemo,
	},
];
