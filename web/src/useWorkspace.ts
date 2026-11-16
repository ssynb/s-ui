import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Annotation, ClientMessage, FolderListing, ModelInfo, Place, SessionEvent, ServerMessage } from "../../server/protocol.ts";

export type ChatItem =
	| { kind: "user"; text: string; image?: string }
	| { kind: "assistant"; text: string; streaming: boolean }
	| { kind: "tool"; id: string; name: string; summary: string; status: "running" | "done" | "error" }
	| { kind: "error"; text: string };

export type Preview = Extract<SessionEvent, { type: "preview" }>;
export type RequestError = { code?: string; message: string };

type State = {
	connected: boolean;
	models: ModelInfo[];
	model?: string;
	exampleDir?: string;
	home?: string;
	places: Place[];
	recentProjects: string[];
	sessionId?: string;
	dir?: string;
	sessionModel?: string;
	preview?: Preview;
	busy: boolean;
	items: ChatItem[];
};

type Action = ServerMessage | { type: "connection"; connected: boolean } | { type: "selectModel"; model: string };

const initial: State = { connected: false, models: [], places: [], recentProjects: [], busy: false, items: [] };

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
			return {
				...state,
				models: action.models,
				model: state.model ?? action.defaultModel,
				exampleDir: action.exampleDir,
				home: action.home,
				places: action.places,
				recentProjects: action.recentProjects,
			};
		case "recentProjects":
			return { ...state, recentProjects: action.projects };
		case "opened":
			if (action.sessionId === state.sessionId) return state;
			return { ...state, sessionId: action.sessionId, dir: action.dir, sessionModel: action.model, preview: undefined, busy: false, items: [] };
		case "event":
			return action.sessionId === state.sessionId ? applySessionEvent(state, action.event) : state;
		case "folder":
			return state;
		case "error":
			// 带 requestId 的失败由发起请求的地方显示；其余进对话流。
			return action.requestId ? state : { ...state, items: [...state.items, { kind: "error", text: action.message }] };
	}
}

type Pending = { resolve: (msg: ServerMessage) => void; reject: (error: RequestError) => void };
type Request = ClientMessage extends infer M ? (M extends { requestId: string } ? Omit<M, "requestId"> : never) : never;

/** 与后台的唯一通道：一条 WebSocket，进来的是事件流，出去的是命令；带 requestId 的命令可等待结果。 */
export function useWorkspace() {
	const [state, dispatch] = useReducer(reducer, initial);
	const socket = useRef<WebSocket>(undefined);
	const pending = useRef(new Map<string, Pending>());

	useEffect(() => {
		const ws = new WebSocket(`ws://${location.host}/ws`);
		socket.current = ws;
		ws.onopen = () => dispatch({ type: "connection", connected: true });
		ws.onclose = () => dispatch({ type: "connection", connected: false });
		ws.onmessage = (m) => {
			const msg = JSON.parse(m.data) as ServerMessage;
			const requestId = "requestId" in msg ? msg.requestId : undefined;
			const waiter = requestId ? pending.current.get(requestId) : undefined;
			if (waiter) {
				pending.current.delete(requestId!);
				if (msg.type === "error") waiter.reject({ code: msg.code, message: msg.message });
				else waiter.resolve(msg);
			}
			dispatch(msg);
		};
		return () => {
			ws.onclose = null;
			ws.close();
		};
	}, []);

	const send = useCallback((msg: ClientMessage) => socket.current?.send(JSON.stringify(msg)), []);
	const request = useCallback(
		(msg: Request) =>
			new Promise<ServerMessage>((resolve, reject) => {
				const requestId = crypto.randomUUID();
				pending.current.set(requestId, { resolve, reject });
				send({ ...msg, requestId } as ClientMessage);
			}),
		[send],
	);
	const { sessionId, model } = state;

	// 返回稳定的函数引用：依赖它们的组件不会因无关状态更新而重跑副作用。
	const selectModel = useCallback((m: string) => dispatch({ type: "selectModel", model: m }), []);
	const open = useCallback(
		async (dir: string) => {
			await request({ type: "open", dir, model: model! });
		},
		[request, model],
	);
	const createProject = useCallback(
		async (parent: string, name: string) => {
			await request({ type: "createProject", parent, name, model: model! });
		},
		[request, model],
	);
	const listFolder = useCallback(
		async (path: string) => ((await request({ type: "listFolder", path })) as Extract<ServerMessage, { type: "folder" }>).listing as FolderListing,
		[request],
	);
	const prompt = useCallback(
		(text: string, annotation?: Annotation) => sessionId && send({ type: "prompt", sessionId, text, annotation }),
		[send, sessionId],
	);
	const abort = useCallback(() => sessionId && send({ type: "abort", sessionId }), [send, sessionId]);

	return { state, selectModel, open, createProject, listFolder, prompt, abort };
}
