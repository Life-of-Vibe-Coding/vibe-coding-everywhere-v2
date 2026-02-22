/**
 * Session Store - Persist chat sessions to AsyncStorage.
 *
 * Sessions are conversations with messages. We remember the last active session
 * and allow listing, switching, and deleting sessions.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Message } from "../core/types";

const STORAGE_KEY = "@vibe_sessions";
const LAST_ACTIVE_KEY = "@vibe_last_active_session";

export interface StoredSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  /** Workspace path where this session was created/last saved. */
  workspacePath?: string | null;
  /** AI provider used in this session (e.g. "claude", "gemini", "pi"). */
  provider?: string | null;
  /** AI model used in this session (e.g. "sonnet4.5", "gemini-2.5-flash"). */
  model?: string | null;
}

export interface SessionStoreState {
  sessions: StoredSession[];
  lastActiveId: string | null;
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser && typeof firstUser.content === "string") {
    const trimmed = firstUser.content.trim();
    return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed || "New chat";
  }
  return "New chat";
}

async function loadRaw(): Promise<SessionStoreState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const lastActiveId = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    const sessions: StoredSession[] = raw ? JSON.parse(raw) : [];
    return { sessions, lastActiveId };
  } catch {
    return { sessions: [], lastActiveId: null };
  }
}

async function saveRaw(state: SessionStoreState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
    if (state.lastActiveId) {
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, state.lastActiveId);
    } else {
      await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
    }
  } catch {
    // Ignore persistence errors
  }
}

/**
 * Load all sessions and last active ID.
 */
export async function loadSessions(): Promise<SessionStoreState> {
  return loadRaw();
}

/**
 * Get a single session by ID.
 */
export async function getSession(id: string): Promise<StoredSession | null> {
  const { sessions } = await loadRaw();
  return sessions.find((s) => s.id === id) ?? null;
}

/**
 * Save or update a session. If id is null, creates a new session.
 * Returns the saved session (with id set).
 * @param workspacePath - Workspace path where the session is being used (stored with session).
 * @param provider - AI provider used in this session (e.g. "claude", "gemini", "pi").
 * @param model - AI model used in this session (e.g. "sonnet4.5", "gemini-2.5-flash").
 */
export async function saveSession(
  messages: Message[],
  id: string | null,
  workspacePath?: string | null,
  provider?: string | null,
  model?: string | null
): Promise<StoredSession> {
  if (messages.length === 0) {
    // Don't persist empty sessions
    const { sessions, lastActiveId } = await loadRaw();
    const existing = id ? sessions.find((s) => s.id === id) : null;
    if (existing) {
      const updated = sessions.filter((s) => s.id !== id);
      await saveRaw({ sessions: updated, lastActiveId: lastActiveId === id ? null : lastActiveId });
    }
    return { id: id ?? "", title: "New chat", messages: [], createdAt: 0, updatedAt: 0 };
  }

  const now = Date.now();
  const title = deriveTitle(messages);

  const { sessions, lastActiveId } = await loadRaw();
  let session: StoredSession;

  if (id) {
    const idx = sessions.findIndex((s) => s.id === id);
    const existing = sessions[idx];
    session = {
      id,
      title,
      messages,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      workspacePath: workspacePath ?? existing?.workspacePath ?? null,
      provider: provider ?? existing?.provider ?? null,
      model: model ?? existing?.model ?? null,
    };
    const updated = [...sessions];
    if (idx >= 0) {
      updated[idx] = session;
    } else {
      updated.push(session);
    }
    await saveRaw({ sessions: updated, lastActiveId: id });
    return session;
  }

  const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  session = {
    id: newId,
    title,
    messages,
    createdAt: now,
    updatedAt: now,
    workspacePath: workspacePath ?? null,
    provider: provider ?? null,
    model: model ?? null,
  };
  const updated = [...sessions, session];
  await saveRaw({ sessions: updated, lastActiveId: newId });
  return session;
}

/**
 * Delete a session by ID.
 */
export async function deleteSession(id: string): Promise<void> {
  const { sessions, lastActiveId } = await loadRaw();
  const updated = sessions.filter((s) => s.id !== id);
  const newLastActive = lastActiveId === id ? null : lastActiveId;
  await saveRaw({ sessions: updated, lastActiveId: newLastActive });
}

/**
 * Set the last active session (when user switches session).
 */
export async function setLastActiveSession(id: string | null): Promise<void> {
  try {
    if (id) {
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, id);
    } else {
      await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
    }
  } catch {
    // Ignore
  }
}

/**
 * Load the last active session if it exists.
 */
export async function loadLastActiveSession(): Promise<StoredSession | null> {
  const lastId = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
  if (!lastId) return null;
  return getSession(lastId);
}
