import { UI_FONT_RULE } from "../../../server/design-tokens.ts";
import type { PolishApi, PolishStatus, TokenName, TokenValues } from "../panels.ts";

/** 待保存的设计变量改动：预览里覆盖的变量值，以及换字体时要引入的网页字体样式表。 */
export type TokenDraft = { tokens: TokenValues; fontImports?: string[] };

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** 保存请求：只带与变量文件里不同的变量；字体样式表变了才带 fontImports（保留文件原有导入，仅追加本次所需字体）。 */
export function savePayload(draft: TokenDraft, status: PolishStatus): PolishApi["saveTokens"]["payload"] {
	const values: TokenValues = {};
	for (const [name, value] of Object.entries(draft.tokens) as [TokenName, string][]) if (status.values[name] !== value) values[name] = value;
	const fontImports = [...new Set([...status.fontImports, ...(draft.fontImports ?? [])])];
	return !sameList(fontImports, status.fontImports) ? { values, fontImports } : { values };
}

/** 覆盖设计变量的临时样式层。 */
export function tokenLayer(tokens: TokenValues) {
	const decls = Object.entries(tokens).map(([name, value]) => `${name}: ${value};`);
	return decls.length ? `:root:root { ${decls.join(" ")} }${tokens["--sui-font-ui"] ? `\n${UI_FONT_RULE}` : ""}` : "";
}
