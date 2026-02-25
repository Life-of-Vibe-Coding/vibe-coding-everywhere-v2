import { useEffect, useRef } from "react";

import type { SessionStatus } from "@/state/sessionManagementStore";
import {
  EMPTY_SESSION_CLEANUP_MS,
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_STATUS_POLL_INTERVAL_MS,
  SESSION_STORE_PAYLOAD_THROTTLE_MS,
} from "@/features/app/appConfig";

type ServerConfig = {
  getBaseUrl: () => string;
};

type UseSessionManagementSyncArgs = {
  serverConfig: ServerConfig;
  sessionStatuses: SessionStatus[];
  setSessionStatuses: (sessions: SessionStatus[]) => void;
  connected: boolean;
  viewingLiveSession: boolean;
  sessionId: string | null;
  workspacePath: string | null;
  provider: string;
  model: string;
  storeProvider: string;
  storeModel: string;
  storeSessionId: string | null;
  additionalSnapshot?: Record<string, unknown>;
};

export function useSessionManagementSync({
  serverConfig,
  sessionStatuses,
  setSessionStatuses,
  connected,
  viewingLiveSession,
  sessionId,
  workspacePath,
  provider,
  model,
  storeProvider,
  storeModel,
  storeSessionId,
  additionalSnapshot,
}: UseSessionManagementSyncArgs) {
  const sessionStorePayloadRef = useRef("");
  const sessionStoreUploadedAtRef = useRef(0);

  useEffect(() => {
    const baseUrl = serverConfig.getBaseUrl();
    const currentPageId = sessionId;
    const cleanup = async () => {
      const now = Date.now();
      for (const s of sessionStatuses) {
        const isNoInput = s.title === "(no input)";
        const isOld = now - s.lastAccess >= EMPTY_SESSION_CLEANUP_MS;
        const isCurrentPage = s.id === currentPageId;
        if (isNoInput && isOld && !isCurrentPage) {
          try {
            await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
          } catch (_) {
            /* ignore */
          }
        }
      }
    };
    const interval = setInterval(cleanup, SESSION_CLEANUP_INTERVAL_MS);
    void cleanup();
    return () => clearInterval(interval);
  }, [serverConfig, viewingLiveSession, sessionId, sessionStatuses]);

  useEffect(() => {
    const baseUrl = serverConfig.getBaseUrl();
    const poll = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/sessions/status`);
        if (!res.ok) return;
        const data = (await res.json()) as { sessions?: SessionStatus[] };
        if (Array.isArray(data?.sessions)) {
          setSessionStatuses(data.sessions);
        }
      } catch {
        // Keep previous data on failure.
      }
    };
    void poll();
    const interval = setInterval(poll, SESSION_STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [serverConfig, setSessionStatuses]);

  useEffect(() => {
    const snapshot = {
      provider: storeProvider,
      model: storeModel,
      currentSessionId: sessionId,
      sessionId: storeSessionId,
      count: sessionStatuses.length,
      sessions: sessionStatuses,
      path: workspacePath,
      connected,
      sseConnected: connected,
      sessionManagement: {
        currentProvider: provider,
        currentModel: model,
        activeSessionId: sessionId,
      },
      ...additionalSnapshot,
    };
    const signature = JSON.stringify(snapshot);
    const now = Date.now();
    const shouldUpload =
      sessionStorePayloadRef.current !== signature ||
      now - sessionStoreUploadedAtRef.current >= SESSION_STORE_PAYLOAD_THROTTLE_MS;
    if (shouldUpload) {
      sessionStorePayloadRef.current = signature;
      sessionStoreUploadedAtRef.current = now;
      if (__DEV__) {
        console.log("[session-management] store snapshot:", snapshot);
      }
      const endpoint = `${serverConfig.getBaseUrl()}/api/session-management-store`;
      if (__DEV__) {
        console.log("[session-management] uploading snapshot to:", endpoint);
      }
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.error(
              "[session-management] failed to upload snapshot:",
              res.status,
              text
            );
          }
        })
        .catch((error) => {
          console.error(
            "[session-management] failed to upload snapshot:",
            String(error),
            "to",
            endpoint
          );
        });
    }
  }, [
    sessionStatuses,
    storeModel,
    storeProvider,
    storeSessionId,
    connected,
    provider,
    model,
    workspacePath,
    viewingLiveSession,
    sessionId,
    serverConfig,
  ]);
}
