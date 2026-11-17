import { useState } from "react";
import type { SimilarProductsProps } from "../panels.ts";
import { type OpenCard, ReferenceViewer } from "./ReferenceViewer.tsx";
import { SimilarTab } from "./SimilarTab.tsx";

/**
 * 可嵌入的同类产品参考（契约见 panels.ts 的 SimilarProductsProps）。与「参考页面」工具窗共用同一项目的查找结果；
 * compact 时两列小卡片，适合窄栏。点开大图沿用同一个查看器。
 */
export function SimilarProducts({ panel, compact }: SimilarProductsProps) {
	const [open, setOpen] = useState<OpenCard>();
	return (
		<>
			<SimilarTab panel={panel} compact={compact} onOpen={(card) => card.image && setOpen({ ...card, image: card.image })} />
			{open && <ReferenceViewer {...panel} card={open} onClose={() => setOpen(undefined)} />}
		</>
	);
}
