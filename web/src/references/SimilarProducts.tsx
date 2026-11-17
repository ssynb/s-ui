import { useState } from "react";
import type { SimilarProductsProps } from "../panels.ts";
import type { RefCard } from "./ReferenceCard.tsx";
import { ReferenceViewer } from "./ReferenceViewer.tsx";
import { SimilarTab } from "./SimilarTab.tsx";

/**
 * 可嵌入的同类产品参考（契约见 panels.ts 的 SimilarProductsProps）。
 * TODO(参考页面)：与「参考页面」工具窗共用同一项目的查找结果；compact 布局。
 */
export function SimilarProducts({ panel }: SimilarProductsProps) {
	const [open, setOpen] = useState<RefCard & { image: string }>();
	return (
		<>
			<SimilarTab panel={panel} pasted={[]} onOpen={(card) => card.image && setOpen({ ...card, image: card.image })} />
			{open && <ReferenceViewer {...panel} card={open} onClose={() => setOpen(undefined)} />}
		</>
	);
}
