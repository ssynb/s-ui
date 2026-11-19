import { parseStylePlan, styleLayer, type StylePlan, type StyleReference } from "../../../../server/modules/style-plan.ts";
import { styleScope } from "../../../../server/modules/style-scope.ts";
import type { AiSubmission, PageInspection, PreviewControl } from "../../panels.ts";

type Tried = { reference: StyleReference; page: PageInspection; plan: StylePlan; css: string };

/** Owns the trial, not source files. Generation is invalidated immediately; layer operations run in order. */
export class StyleTrial {
	private epoch = 0;
	private tried?: Tried;
	private layer?: string;
	private writes: Promise<void> = Promise.resolve();
	private preview: PreviewControl;
	private submit: (submission: AiSubmission) => void;
	constructor(preview: PreviewControl, submit: (submission: AiSubmission) => void) {
		this.preview = preview;
		this.submit = submit;
	}
	private write(operation: () => Promise<void>) {
		const result = this.writes.then(operation, operation);
		this.writes = result;
		return result;
	}
	invalidate() {
		++this.epoch;
		this.tried = undefined;
		this.layer = undefined;
	}
	async cancel() {
		const layer = this.layer;
		this.invalidate();
		const epoch = this.epoch;
		if (!layer) return;
		try {
			await this.write(() => this.preview.clearLayer(layer));
		} catch (error) {
			if (this.epoch === epoch) this.layer = layer;
			throw error;
		}
	}
	async try(reference: StyleReference, propose: (page: PageInspection) => Promise<StylePlan>) {
		const epoch = ++this.epoch;
		this.tried = undefined;
		const page = await this.preview.inspect();
		if (epoch !== this.epoch) return;
		const scope = styleScope(page);
		const plan = parseStylePlan(await propose(page), page);
		if (epoch !== this.epoch) return;
		const current = await this.preview.inspect();
		if (current.url !== page.url || styleScope(current) !== scope || epoch !== this.epoch) return;
		const css = styleLayer(plan, page);
		await this.write(async () => {
			if (epoch !== this.epoch) return;
			this.layer = scope;
			await this.preview.applyLayer(this.layer, css);
		});
		if (epoch !== this.epoch) return;
		this.tried = { reference, page, plan, css };
		return plan;
	}
	async confirm(): Promise<AiSubmission> {
		const tried = this.tried;
		const epoch = this.epoch;
		if (!tried) throw new Error("No successful preview trial to confirm");
		const current = await this.preview.inspect();
		if (epoch !== this.epoch) throw new Error("Preview trial was cancelled");
		if (current.url !== tried.page.url || styleScope(current) !== styleScope(tried.page)) {
			await this.cancel();
			throw new Error("The page changed; generate a new preview");
		}
		const submission: AiSubmission = {
			text: `用户已确认在当前页面试过的风格，请修改源码。保留内容与功能；参考图只提供设计方向，不要求逐像素一致。\nPage: ${tried.page.url}\nReference: ${tried.reference.name} ${tried.reference.url}\n${tried.plan.summary}\n实际试过的临时样式（按项目结构合理实现，检查响应式与可读性）：\n${tried.css}`,
			images: [{ data: tried.reference.image, mimeType: "image/jpeg" }],
		};
		const clearing = this.cancel();
		const confirmingEpoch = this.epoch;
		await clearing;
		if (this.epoch !== confirmingEpoch) throw new Error("The page changed or the trial was cancelled");
		this.submit(submission);
		return submission;
	}
}
