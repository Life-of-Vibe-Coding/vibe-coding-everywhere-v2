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
  getOrCreateSessionMessages: (sid: string) => Message[];
  setSessionMessages: (sid: string, messages: Message[]) => void;
  getSessionDraft: (sid: string) => string;
  setSessionDraft: (sid: string, draft: string) => void;
  displayedSessionIdRef: MutableRefObject<string | null>;
  setLiveSessionMessages: Dispatch<SetStateAction<Message[]>>;
  setSessionStateForSession: (sid: string | null, next: SessionRuntimeState) => void;
  liveMessagesRef: MutableRefObject<Message[]>;
  nextIdRef: MutableRefObject<number>;
};

export const createSessionMessageHandlers = (deps: SessionMessageHandlerDeps): SessionMessageHandlers => {
  const {
    sidRef,
    getOrCreateSessionState,
    getOrCreateSessionMessages,
    setSessionMessages,
    getSessionDraft,
    setSessionDraft,
    displayedSessionIdRef,
    setLiveSessionMessages,
    setSessionStateForSession,
    liveMessagesRef,
    nextIdRef,
  } = deps;

  const addMessageForSession = (role: Message["role"], content: string, codeReferences?: CodeReference[]) => {
    const id = `msg-${++nextIdRef.current}`;
    const sid = sidRef.current;
    const currentMessages = getOrCreateSessionMessages(sid);
    const newMsg: Message = { id, role, content, codeReferences };
    const nextMessages = [...currentMessages, newMsg];

    setSessionMessages(sid, nextMessages);
    if (displayedSessionIdRef.current === sid) {
      setLiveSessionMessages([...nextMessages]);
      liveMessagesRef.current = nextMessages;
    }
    return id;
  };

  const appendAssistantTextForSession = (chunk: string) => {
    const sanitized = stripAnsi(chunk);
    if (!sanitized) return;
    const sid = sidRef.current;
    const state = getOrCreateSessionState(sid);
    const currentMessages = getOrCreateSessionMessages(sid);
    const currentDraft = getSessionDraft(sid);
    const nextDraft = currentDraft ? currentDraft + sanitized : sanitized;

    setSessionDraft(sid, nextDraft);
    const last = currentMessages[currentMessages.length - 1];
    if (last?.role === "assistant") {
      setSessionMessages(sid, [...currentMessages.slice(0, -1), { ...last, content: nextDraft }]);
    } else {
      setSessionMessages(sid, [...currentMessages, { id: `msg-${++nextIdRef.current}`, role: "assistant", content: sanitized }]);
    }

    state.sessionState = "running";
    const nextMessages = getOrCreateSessionMessages(sid);
    if (displayedSessionIdRef.current === sid) {
      setLiveSessionMessages([...nextMessages]);
      setSessionStateForSession(sid, "running");
      liveMessagesRef.current = nextMessages;
    }
  };

  const finalizeAssistantMessageForSession = () => {
    const sid = sidRef.current;
    const state = getOrCreateSessionState(sid);
    const currentMessages = getOrCreateSessionMessages(sid);
    const raw = getSessionDraft(sid);
    const cleaned = stripTrailingIncompleteTag(raw ?? "");

    if (cleaned !== (raw ?? "")) {
      const last = currentMessages[currentMessages.length - 1];
      if (last?.role === "assistant") {
        const trimmed = cleaned.trim();
        if (trimmed === "") {
          setSessionMessages(sid, currentMessages.slice(0, -1));
        } else {
          setSessionMessages(sid, [...currentMessages.slice(0, -1), { ...last, content: cleaned }]);
        }
      }
    }

    const afterTrimMessages = getOrCreateSessionMessages(sid);
    const last = afterTrimMessages[afterTrimMessages.length - 1];
    if (last?.role === "assistant" && (last.content ?? "").trim() === "") {
      setSessionMessages(sid, afterTrimMessages.slice(0, -1));
    }

    setSessionDraft(sid, "");
    const finalMessages = getOrCreateSessionMessages(sid);
    state.sessionState = "idle";
    if (displayedSessionIdRef.current === sid) {
      setLiveSessionMessages([...finalMessages]);
      setSessionStateForSession(sid, "idle");
      liveMessagesRef.current = finalMessages;
    }
  };

  return {
    addMessageForSession,
    appendAssistantTextForSession,
    finalizeAssistantMessageForSession,
  };
};
