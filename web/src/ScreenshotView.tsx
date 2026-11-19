import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton, Modal } from "./ui.tsx";

export const jpegSrc = (base64: string) => `data:image/jpeg;base64,${base64}`;

type Props = { title: string; image?: string; closeLabel: string; onClose: () => void; children: ReactNode };

/** 截图放大视图：整页滚动区域与右侧动作共用一套布局。 */
export function ScreenshotView({ title, image, onClose, children, closeLabel }: Props) {
	return (
		<Modal title={title} onClose={onClose} className="h-[88vh] w-[min(1240px,94vw)]">
			<div className="flex min-h-0 flex-1 border-t border-line">
				<div className="min-w-0 flex-1 overflow-y-auto bg-app">
					{image && <img src={jpegSrc(image)} alt={title} className="block w-full" />}
				</div>
				<aside className="flex w-64 shrink-0 flex-col gap-4 border-l border-line p-4">{children}</aside>
			</div>
			<IconButton label={closeLabel} onClick={onClose} className="absolute top-2.5 right-2.5"><X size={16} /></IconButton>
		</Modal>
	);
}
