// 「打磨」素材共用的类型（参数 schema 源自原组件库）。

/** 素材自带的双语文案。 */
export type Text = { zh: string; en: string };

type ParamBase = { key: string; label: Text };

export type RangeParam = ParamBase & { kind: "range"; min: number; max: number; step: number; unit: string; default: number };
export type SelectParam = ParamBase & {
	kind: "select";
	options: { value: string; label: Text }[];
	default: string;
	/** 交给 AI 时连同取值一起写出（如缓动曲线的 cubic-bezier）。 */
	showValue?: boolean;
};
export type ParamSpec = RangeParam | SelectParam;

export type ParamValues = Record<string, number | string>;

export function defaults(params: ParamSpec[]): ParamValues {
	return Object.fromEntries(params.map((p) => [p.key, p.default]));
}
