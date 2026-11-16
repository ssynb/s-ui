import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Annotation, ClientMessage, ModelInfo, SessionEvent, ServerMessage } from "../../server/protocol.ts";

export type ChatItem =
	| { kind: "user"; text: string; image?: string }
	| { kind: "assistant"; text: string; streaming: boolean }
	| { kind: "tool"; id: string; name: string; summary: string; status: "running" | "done" | "error" }
	| { kind: "error"; text: string };

export type Preview = Extract<SessionEvent, { type: "preview" }>;

type State = {
	connected: boolean;
	models: ModelInfo[];
	model?: string;
	exampleDir?: string;
	sessionId?: string;
	dir?: string;
	preview?: Preview;
	busy: boolean;
	items: ChatItem[];
};

type Action = ServerMessage | { type: "connection"; connected: boolean } | { type: "selectModel"; model: string };

const initial: State = { connected: false, models: [], busy: false, items: [] };

function applyAssistantDelta(items: ChatItem[], text: string): ChatItem[] {
	const last = items.at(-1);
	if (last?.kind === "assistant" && last.streaming) return [...items.slice(0, -1), { ...last, text: last.text + text }];
	return [...items, { kind: "assistant", text, streaming: true }];
}

function applyTool(items: ChatItem[], e: Extract<SessionEvent, { type: "tool" }>): ChatItem[] {
	if (e.phase === "start") return [...items, { kind: "tool", id: e.id, name: e.name, summary: e.summary, status: "running" }];
	const status = e.isError ? "error" : "done";
	return items.map((item) => (item.kind === "tool" && item.id === e.id ? { ...item, status } : item));
}

function applySessionEvent(state: State, e: SessionEvent): State {
	switch (e.type) {
		case "preview":
			return { ...state, preview: e };
		case "busy":
			return { ...state, busy: e.busy };
		case "user":
			return { ...state, items: [...state.items, { kind: "user", text: e.text, image: e.image }] };
		case "assistant_delta":
			return { ...state, items: applyAssistantDelta(state.items, e.text) };
		case "assistant_end":
			return { ...state, items: state.items.map((i) => (i.kind === "assistant" ? { ...i, streaming: false } : i)) };
		case "tool":
			return { ...state, items: applyTool(state.items, e) };
		case "error":
			return { ...state, items: [...state.items, { kind: "error", text: e.message }] };
	}
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "connection":
			return { ...state, connected: action.connected };
		case "selectModel":
			return { ...state, model: action.model };
		case "hello":
			return { ...state, models: action.models, model: state.model ?? action.defaultModel, exampleDir: action.exampleDir };
		case "opened":
			return { ...state, sessionId: action.sessionId, dir: action.dir, preview: undefined, busy: false, items: [] };
		case "event":
			return action.sessionId === state.sessionId ? applySessionEvent(state, action.event) : state;
		case "error":
			return { ...state, items: [...state.items, { kind: "error", text: action.message }] };
	}
}

/** 与后台的唯一通道：一条 WebSocket，进来的是事件流，出去的是命令。 */
export function useWorkspace() {
	const [state, dispatch] = useReducer(reducer, initial);
	const socket = useRef<WebSocket>(undefined);

	useEffect(() => {
		const ws = new WebSocket(`ws://${location.host}/ws`);
		socket.current = ws;
		ws.onopen = () => dispatch({ type: "connection", connected: true });
		ws.onclose = () => dispatch({ type: "connection", connected: false });
		ws.onmessage = (m) => dispatch(JSON.parse(m.data) as ServerMessage);
		return () => {
			ws.onclose = null;
			ws.close();
		};
	}, []);

	const send = useCallback((msg: ClientMessage) => socket.current?.send(JSON.stringify(msg)), []);
	const { sessionId, model } = state;

	return {
		state,
		selectModel: (m: string) => dispatch({ type: "selectModel", model: m }),
		open: (dir: string) => model && send({ type: "open", dir, model }),
		prompt: (text: string, annotation?: Annotation) => sessionId && send({ type: "prompt", sessionId, text, annotation }),
		abort: () => sessionId && send({ type: "abort", sessionId }),
	};
}
