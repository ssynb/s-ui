import { useEffect, useState } from "react";
import type { Locale, PageInspection, TokenValues } from "../panels.ts";
import { FONTS, FONT_ROLES, type FontRole } from "./fonts.ts";
import { Tile, TextButton } from "./parts.tsx";
import type { PolishDraft } from "./state.ts";
import { STRINGS } from "./strings.ts";

type Props = {
	locale: Locale;
	draft: PolishDraft;
	setDraft: (update: (d: PolishDraft) => PolishDraft) => void;
	saved: TokenValues;
	disabled: boolean;
	note?: string;
	inspection?: PageInspection;
};

export function FontSection({ locale, draft, setDraft, saved, disabled, note, inspection }: Props) {
	const s = STRINGS[locale];
	const [role, setRole] = useState<FontRole>("heading");
	const body = FONTS.find((f) => f.id === draft.fonts.body)?.family ?? saved[FONT_ROLES.body];
	const chosen = FONTS.find((f) => f.id === draft.fonts[role]);
	const followsBody = role === "ui" && (draft.fonts.ui === "body" || (!draft.fonts.ui && (!saved[FONT_ROLES.ui] || saved[FONT_ROLES.ui] === "var(--sui-font-sans)")));
	const family = followsBody ? body : (chosen?.family ?? saved[FONT_ROLES[role]]);
	const selected = FONTS.find((f) => f.family === family);
	const sample = inspection?.components.find((c) => c.kind === (role === "heading" ? "heading" : role === "ui" ? "button" : "list"))?.text || inspection?.components.find((c) => c.text)?.text;
	useEffect(() => {
		const links = (selected?.urls ?? []).map((url) => {
			const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: url });
			document.head.append(link);
			return link;
		});
		return () => links.forEach((link) => link.remove());
	}, [selected]);
	const pick = (id?: string) =>
		setDraft((d) => {
			const fonts = { ...d.fonts };
			const value = id === "body" ? "var(--sui-font-sans)" : FONTS.find((f) => f.id === id)?.family;
			if (id === undefined || value === saved[FONT_ROLES[role]] || (id === "body" && !saved[FONT_ROLES.ui])) delete fonts[role];
			else fonts[role] = id;
			return { ...d, fonts };
		});
	return (
		<section aria-label={s.fonts} className="space-y-3">
			<div className="flex gap-1" aria-label={s.fontRole}>
				{(Object.keys(FONT_ROLES) as FontRole[]).map((r) => (
					<button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`h-8 cursor-pointer rounded px-2 text-xs ${role === r ? "bg-hover text-fg" : "text-muted"}`}>
						{s.fontRoles[r]}
					</button>
				))}
			</div>
			{note && <p className="text-xs text-muted">{note}</p>}
			<fieldset disabled={disabled} className="space-y-3 disabled:opacity-50">
				<div className="flex items-center gap-2">
					<span className="flex-1 text-xs text-muted">{followsBody ? s.followBody : s.current}</span>
					<TextButton disabled={!draft.fonts[role]} onClick={() => pick()}>
						{s.reset}
					</TextButton>
				</div>
				{sample ? (
					<p className="break-words rounded bg-panel p-3 text-xl leading-relaxed" style={{ fontFamily: family }}>
						{sample}
					</p>
				) : (
					<p className="text-xs text-muted">{s.noFontSample}</p>
				)}
				{role === "ui" && (
					<Tile selected={followsBody} onClick={() => pick("body")} className="w-full p-2 text-xs">
						{s.followBody}
					</Tile>
				)}
				<div className="space-y-1.5">
					{FONTS.map((font) => (
						<Tile key={font.id} selected={draft.fonts[role] ? draft.fonts[role] === font.id : saved[FONT_ROLES[role]] === font.family} onClick={() => pick(font.id)} className="w-full p-2 text-xs">
							{font.name[locale]}
						</Tile>
					))}
				</div>
			</fieldset>
		</section>
	);
}
