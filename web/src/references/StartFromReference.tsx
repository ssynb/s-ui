import type { StartFromReferenceProps } from "../panels.ts";

/**
 * 空项目时预览区显示的内容（契约见 panels.ts 的 StartFromReferenceProps）。
 * TODO(参考页面)：参考页面网格，选一张“照这个做”让 AI 按参考搭页面。
 */
export function StartFromReference({ defaultMessage }: StartFromReferenceProps) {
	return (
		<div className="flex min-h-full items-center justify-center p-6">
			<p className="max-w-md text-center text-muted">{defaultMessage}</p>
		</div>
	);
}
