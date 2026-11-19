import { renderAnnotation } from "./annotate.ts";
import type { Annotation, ImageAttachment } from "./protocol.ts";

/** 相同现场共用一张编号图；滚动、弹窗或 DOM 改变后保留各自现场。 */
export async function renderAnnotations(text: string, annotations: Annotation[], projectDir: string) {
	const groups = new Map<string, Annotation[]>();
	for (const [index, annotation] of annotations.entries()) {
		const item = { ...annotation, number: annotation.number ?? index + 1 };
		const { capture, viewport } = item;
		const key = JSON.stringify([capture.href, capture.html, capture.scrollX, capture.scrollY, viewport]);
		const group = groups.get(key) ?? [];
		group.push(item); groups.set(key, group);
	}
	const images: ImageAttachment[] = [];
	const descriptions: string[] = [];
	for (const group of groups.values()) {
		const first = group[0]!;
		const result = await renderAnnotation({ ...first, capture: { ...first.capture, elements: group.flatMap(a => a.capture.elements) }, circles: group, projectDir });
		images.push({ data: result.png.toString("base64"), mimeType: "image/png" });
		let offset = 0;
		for (const item of group) {
			const elements = result.elements.slice(offset, offset + item.capture.elements.length);
			offset += elements.length;
			descriptions.push(`Circle ${item.number} — screenshot ${images.length}, viewport ${item.viewport.width}x${item.viewport.height}, scroll ${item.capture.scrollX},${item.capture.scrollY}
Note: ${item.note || "(no individual note)"}
Elements inside this circle:
${elements.map(e => `selector: ${e.selector}\nsource: ${e.sources.join(", ") || "unknown"}\nhtml: ${e.html}`).join("\n") || "(none detected)"}`);
		}
	}
	return { fullText: `Change the project's source code for these numbered circles. Each screenshot preserves the page at capture time.\nOverall request: ${text}\n\n${descriptions.join("\n\n")}`, images };
}
