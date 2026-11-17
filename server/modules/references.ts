// 「参考页面」工具窗的后台模块：找同类产品页面、给任意网页截图。动作与载荷类型在 ReferencesApi 里声明，前端面板按同一类型调用。
import { defineModule } from "../module-kit.ts";
import { type RejectReason, type Shot, shoot } from "./page-shots.ts";
import { type Candidate, guessSimilarProducts, type ProductGuess } from "./similar-products.ts";

export type { Candidate, ProductGuess, RejectReason, Shot };

/** 验证通过、带首屏截图的参考页面。 */
export type Reference = Candidate & { title: string; image: string };

/** findSimilar 的进度：先给出产品判断与候选数，之后每验证完一个推一次（ref 为空表示被丢弃）。 */
export type FindProgress =
	| { phase: "reading" }
	| { phase: "checking"; product: ProductGuess; total: number }
	| { phase: "checked"; candidate: Candidate; ref?: Reference };

export type Dropped = { url: string; reason: RejectReason; detail: string };
export type FindResult = { product: ProductGuess; references: Reference[]; dropped: Dropped[] };

/** 动作名 → { payload, result }。 */
export type ReferencesApi = {
	/**
	 * 找同类真实产品的对应页面，逐个打开验证并截首屏。给了 description（项目还没有页面时用户想做什么）就按描述判断，
	 * 不读项目文件；否则读当前项目。
	 */
	findSimilar: { payload: { locale: "en" | "zh"; description?: string }; result: FindResult };
	/** 打开一个网页截图（首屏或整页），结果按 URL 缓存。 */
	capture: { payload: { url: string; fullPage?: boolean }; result: Shot };
};

const toReference = (candidate: Candidate, shot: Shot): Reference | undefined =>
	shot.ok ? { ...candidate, title: shot.title, image: shot.image } : undefined;

export const referencesModule = defineModule<ReferencesApi>({
	findSimilar: async ({ locale, description }, ctx) => {
		if (!ctx.project) throw new Error("No project is open");
		ctx.progress({ phase: "reading" } satisfies FindProgress);
		const { dir, model } = ctx.project;
		const { product, candidates } = await guessSimilarProducts({ dir, modelRuntime: ctx.modelRuntime, model, locale, description: description?.trim() || undefined });
		ctx.progress({ phase: "checking", product, total: candidates.length } satisfies FindProgress);
		const checked = await Promise.all(
			candidates.map(async (candidate) => {
				const shot = await shoot(candidate.url);
				ctx.progress({ phase: "checked", candidate, ref: toReference(candidate, shot) } satisfies FindProgress);
				return { candidate, shot };
			}),
		);
		return {
			product,
			references: checked.flatMap(({ candidate, shot }) => toReference(candidate, shot) ?? []),
			dropped: checked.flatMap(({ shot }) => (shot.ok ? [] : [{ url: shot.url, reason: shot.reason, detail: shot.detail }])),
		};
	},
	capture: ({ url, fullPage }) => shoot(url, { fullPage }),
});
