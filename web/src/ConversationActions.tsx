import { History, SquarePen } from "lucide-react";
import type { ConversationInfo } from "../../server/protocol.ts";
import type { Locale, T } from "./i18n.ts";
import { IconButton, Menu, MenuItem, MenuLabel } from "./ui.tsx";

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
];

function relativeTime(locale: Locale, at: number) {
	const format = new Intl.RelativeTimeFormat(locale === "zh" ? "zh-CN" : "en", { numeric: "auto" });
	const elapsed = at - Date.now();
	const [unit, size] = RELATIVE_UNITS.find(([, size]) => Math.abs(elapsed) >= size) ?? ["minute", 60_000];
	return format.format(Math.round(elapsed / size), unit);
}

type Props = {
	t: T;
	locale: Locale;
	current?: string;
	conversations: ConversationInfo[];
	onNew: () => void;
	onSwitch: (id: string) => void;
};

/** 对话工具窗标题栏上的操作：IDEA 式的“新对话”和最近对话下拉。 */
export function ConversationActions({ t, locale, current, conversations, onNew, onSwitch }: Props) {
	return (
		<>
			{conversations.length > 0 && (
				<Menu align="right" buttonLabel={t.conversationHistory} title={t.conversationHistory} button={<History size={16} className="text-muted" />}>
					{(close) => (
						<>
							<MenuLabel>{t.recentConversations}</MenuLabel>
							{conversations.map((c) => (
								<MenuItem
									key={c.id}
									selected={c.id === current}
									onSelect={() => {
										close();
										if (c.id !== current) onSwitch(c.id);
									}}
								>
									<span className="min-w-0 flex-1">
										<span className="block truncate">{c.title || t.emptyConversation}</span>
										<span className="block text-xs text-muted">{relativeTime(locale, c.updatedAt)}</span>
									</span>
								</MenuItem>
							))}
						</>
					)}
				</Menu>
			)}
			<IconButton label={t.newConversation} onClick={onNew}>
				<SquarePen size={16} />
			</IconButton>
		</>
	);
}
