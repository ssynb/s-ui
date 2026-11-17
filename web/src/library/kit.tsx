import { RotateCcw } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import type { Locale } from "../i18n.ts";

// 演示组件共用的小工具。

/** 时长（毫秒）乘上全局放慢倍数，写成 CSS 时长。 */
export const ms = (value: number, slow: number) => `${value * slow}ms`;

/** 带 CSS 自定义属性的内联样式（演示把参数经变量交给 library.css）。 */
export const vars = (style: Record<string, string | number>) => style as CSSProperties;

export const pick = (locale: Locale, zh: string, en: string) => (locale === "zh" ? zh : en);

/** 演示区右下角的“重播 / 再来一次”按钮。 */
export function Replay({ locale, onClick, label }: { locale: Locale; onClick: () => void; label?: string }) {
	const text = label ?? pick(locale, "重播", "Replay");
	return (
		<button
			type="button"
			onClick={onClick}
			className="absolute right-1.5 bottom-1.5 inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:bg-hover hover:text-fg"
		>
			<RotateCcw size={12} aria-hidden />
			{text}
		</button>
	);
}

/** 先回到起点、下一帧再到终点，让同一个过渡可以重播。 */
export function restart(set: (on: boolean) => void) {
	set(false);
	requestAnimationFrame(() => requestAnimationFrame(() => set(true)));
}

/** 滑动指示块（选中底块、下划线）的位置：量出当前选项的左边距和宽度。 */
export function useIndicator(active: number, remeasure: unknown) {
	const refs = useRef<(HTMLElement | null)[]>([]);
	const [box, setBox] = useState({ left: 0, width: 0 });
	useLayoutEffect(() => {
		const el = refs.current[active];
		if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
	}, [active, remeasure]);
	const ref = (i: number) => (el: HTMLElement | null) => {
		refs.current[i] = el;
	};
	return { box, ref };
}
