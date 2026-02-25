import type { Message } from "@/core/types";
import type { SessionLiveState } from "./hooks-types";

export const getOrCreateSessionState = (sessionStates: Map<string, SessionLiveState>, sid: string): SessionLiveState => {
  let state = sessionStates.get(sid);
  if (!state) {
    state = { sessionState: "idle" };
    sessionStates.set(sid, state);
  }
  return state;
};

export const getOrCreateSessionMessages = (sessionMessages: Map<string, Message[]>, sid: string): Message[] => {
  let messages = sessionMessages.get(sid);
  if (!messages) {
    messages = [];
    sessionMessages.set(sid, messages);
  }
  return messages;
};

export const getSessionDraft = (sessionDrafts: Map<string, string>, sid: string): string => sessionDrafts.get(sid) ?? "";

export const setSessionDraft = (sessionDrafts: Map<string, string>, sid: string, draft: string): void => {
  if (draft.length > 0) {
    sessionDrafts.set(sid, draft);
    return;
  }
  sessionDrafts.delete(sid);
};

export const setSessionMessages = (sessionMessages: Map<string, Message[]>, sid: string, messages: Message[]): void => {
  sessionMessages.set(sid, messages);
};

export const moveSessionCacheData = (
  currentSid: string,
  nextSid: string,
  sessionStates: Map<string, SessionLiveState>,
  sessionMessages: Map<string, Message[]>,
  sessionDrafts: Map<string, string>,
): void => {
  const state = sessionStates.get(currentSid);
  const messages = sessionMessages.get(currentSid);
  const draft = sessionDrafts.get(currentSid);

  if (state) {
    sessionStates.delete(currentSid);
    sessionStates.set(nextSid, state);
  }
  if (messages) {
    sessionMessages.delete(currentSid);
    sessionMessages.set(nextSid, messages);
  }
  if (draft !== undefined) {
    sessionDrafts.delete(currentSid);
    sessionDrafts.set(nextSid, draft);
  }
};
