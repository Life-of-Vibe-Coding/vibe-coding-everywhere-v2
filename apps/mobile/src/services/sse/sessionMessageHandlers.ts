import { stripAnsi, stripTrailingIncompleteTag } from "@/services/providers/stream";
import type { Message, CodeReference } from "@/core/types";
import type { SessionLiveState, SessionRuntimeState } from "./hooks-types";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";

export interface SessionMessageHandlers {
  addMessageForSession: (role: Message["role"], content: string, codeReferences?: CodeReference[]) => string;
  appendAssistantTextForSession: (chunk: string) => void;
  finalizeAssistantMessageForSession: () => void;
}

type SessionMessageHandlerDeps = {
  sidRef: { current: string };
  getOrCreateSessionState: (sid: string) => SessionLiveState;
  displayedSessionIdRef: MutableRefObject<string | null>;
  setLiveSessionMessages: Dispatch<SetStateAction<Message[]>>;
  setTypingIndicator: (value: boolean) => void;
  setSessionStateForSession: (sid: string | null, next: SessionRuntimeState) => void;
  liveMessagesRef: MutableRefObject<Message[]>;
  currentAssistantContentRef: MutableRefObject<string>;
  nextIdRef: MutableRefObject<number>;
};

export const createSessionMessageHandlers = (deps: SessionMessageHandlerDeps): SessionMessageHandlers => {
  const {
    sidRef,
    getOrCreateSessionState,
    displayedSessionIdRef,
    setLiveSessionMessages,
    setTypingIndicator,
    setSessionStateForSession,
    liveMessagesRef,
    currentAssistantContentRef,
    nextIdRef,
  } = deps;

  const addMessageForSession = (role: Message["role"], content: string, codeReferences?: CodeReference[]) => {
    const id = `msg-${++nextIdRef.current}`;
    const state = getOrCreateSessionState(sidRef.current);
    const newMsg: Message = { id, role, content, codeReferences };
    state.messages = [...state.messages, newMsg];
    if (displayedSessionIdRef.current === sidRef.current) {
      setLiveSessionMessages([...state.messages]);
      liveMessagesRef.current = state.messages;
    }
    return id;
  };

  const appendAssistantTextForSession = (chunk: string) => {
    const sanitized = stripAnsi(chunk);
    if (!sanitized) return;
    const state = getOrCreateSessionState(sidRef.current);
    const next = state.currentAssistantContent ? state.currentAssistantContent + sanitized : sanitized;
    state.currentAssistantContent = next;
    const last = state.messages[state.messages.length - 1];
    if (last?.role === "assistant") {
      state.messages = [...state.messages.slice(0, -1), { ...last, content: next }];
    } else {
      state.messages = [...state.messages, { id: `msg-${++nextIdRef.current}`, role: "assistant", content: sanitized }];
    }
    state.typingIndicator = true;
    state.sessionState = "running";
    if (displayedSessionIdRef.current === sidRef.current) {
      setLiveSessionMessages([...state.messages]);
      setTypingIndicator(true);
      setSessionStateForSession(sidRef.current, "running");
      liveMessagesRef.current = state.messages;
      currentAssistantContentRef.current = next;
    }
  };

  const finalizeAssistantMessageForSession = () => {
    const state = getOrCreateSessionState(sidRef.current);
    const raw = state.currentAssistantContent;
    const cleaned = stripTrailingIncompleteTag(raw ?? "");
    if (cleaned !== (raw ?? "")) {
      const last = state.messages[state.messages.length - 1];
      if (last?.role === "assistant") {
        const trimmed = cleaned.trim();
        if (trimmed === "") state.messages = state.messages.slice(0, -1);
        else state.messages = [...state.messages.slice(0, -1), { ...last, content: cleaned }];
      }
      state.currentAssistantContent = cleaned;
    }
    const last = state.messages[state.messages.length - 1];
    if (last?.role === "assistant" && (last.content ?? "").trim() === "") {
      state.messages = state.messages.slice(0, -1);
    }
    state.currentAssistantContent = "";
    state.typingIndicator = false;
    state.sessionState = "idle";
    if (displayedSessionIdRef.current === sidRef.current) {
      setLiveSessionMessages([...state.messages]);
      setTypingIndicator(false);
      setSessionStateForSession(sidRef.current, "idle");
      currentAssistantContentRef.current = "";
      liveMessagesRef.current = state.messages;
    }
  };

  return {
    addMessageForSession,
    appendAssistantTextForSession,
    finalizeAssistantMessageForSession,
  };
};
