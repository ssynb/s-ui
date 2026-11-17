import type { PolishApi, PolishStatus, TokenName, TokenValues } from "../panels.ts";

/** 待保存的设计变量改动：预览里覆盖的变量值，以及换字体时要引入的网页字体样式表。 */
export type TokenDraft = { tokens: TokenValues; fontImports?: string[] };

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** 保存请求：只带与变量文件里不同的变量；字体样式表变了才带 fontImports（它会整体替换文件里的 @import）。 */
export function savePayload(draft: TokenDraft, status: PolishStatus): PolishApi["saveTokens"]["payload"] {
	const values: TokenValues = {};
	for (const [name, value] of Object.entries(draft.tokens) as [TokenName, string][]) if (status.values[name] !== value) values[name] = value;
	const fontsChanged = draft.fontImports && !sameList(draft.fontImports, status.fontImports);
	return fontsChanged ? { values, fontImports: draft.fontImports } : { values };
}

/** 覆盖设计变量的临时样式层。 */
export function tokenLayer(tokens: TokenValues) {
	const decls = Object.entries(tokens).map(([name, value]) => `${name}: ${value};`);
	return decls.length ? `:root:root { ${decls.join(" ")} }` : "";
}
