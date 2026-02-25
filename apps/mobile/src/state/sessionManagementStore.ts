import { create } from "zustand";

export type SessionStatus = {
  id: string;
  cwd: string | null;
  model: string | null;
  lastAccess: number;
  status: "running" | "idling";
  title: string;
};

export type ProviderName = "pi" | "claude" | "gemini" | "codex";

export type SessionManagementStore = {
  sessionStatuses: SessionStatus[];
  currentSessionId: string | null;
  sessionId: string | null;
  provider: ProviderName;
  model: string;
  setSessionStatuses: (sessions: SessionStatus[]) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setSessionId: (sessionId: string | null) => void;
  setProvider: (provider: ProviderName) => void;
  setModel: (model: string) => void;
  upsertSessionStatus: (session: SessionStatus) => void;
  removeSessionStatus: (sessionId: string) => void;
  clearSessionStatuses: () => void;
};

export const useSessionManagementStore = create<SessionManagementStore>((set) => ({
  sessionStatuses: [],
  currentSessionId: null,
  sessionId: null,
  provider: "pi",
  model: "gpt-5.1-codex-mini",
  setSessionStatuses: (sessions) => set({ sessionStatuses: sessions }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  setSessionId: (sessionId) => set({ sessionId }),
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  upsertSessionStatus: (session) =>
    set((state) => {
      const next = state.sessionStatuses.filter((s) => s.id !== session.id);
      return { sessionStatuses: [session, ...next] };
    }),
  removeSessionStatus: (sessionId) =>
    set((state) => ({
      sessionStatuses: state.sessionStatuses.filter((s) => s.id !== sessionId),
    })),
  clearSessionStatuses: () => set({ sessionStatuses: [] }),
}));

export const isSessionRunning = (session: SessionStatus): boolean =>
  session.status === "running";
