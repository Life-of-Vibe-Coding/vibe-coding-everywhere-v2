import React, { useCallback, useEffect, useMemo, useState } from "react";

import { triggerHaptic } from "@/design-system";
import { createWorkspaceFileService } from "@/core";
import type { IServerConfig } from "@/core/types";
import { useFileViewer } from "@/features/app/useFileViewer";
import {
  basename,
  dirname,
  isAbsolutePath,
  normalizePathSeparators,
  toWorkspaceRelativePath,
} from "@/utils/path";

export type WorkspaceFileControllerProps = {
  serverConfig: Pick<IServerConfig, "getBaseUrl" | "resolvePreviewUrl">;
  onWorkspaceSelectedFromPicker?: (path?: string) => void;
  children: (state: WorkspaceFileControllerState) => React.ReactNode;
};

export type WorkspaceFileControllerState = {
  workspacePath: string | null;
  workspacePathLoading: boolean;
  selectedFilePath: string | null;
  fileContent: string | null;
  fileIsImage: boolean;
  fileLoading: boolean;
  fileError: string | null;
  onFileSelectFromSidebar: (path: string) => void;
  onFileSelectFromChat: (path: string) => void;
  onCloseFileViewer: () => void;
  fetchWorkspacePath: () => void;
  onWorkspaceSelectedFromPicker: (path?: string) => void;
  switchWorkspaceForSession: (cwd: string) => Promise<void>;
};

export function WorkspaceFileController({
  serverConfig,
  onWorkspaceSelectedFromPicker,
  children,
}: WorkspaceFileControllerProps) {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspacePathLoading, setWorkspacePathLoading] = useState(false);

  const workspaceFileService = useMemo(() => createWorkspaceFileService(serverConfig), [serverConfig]);

  const {
    selectedFilePath,
    fileContent,
    fileIsImage,
    fileLoading,
    fileError,
    openFile,
    closeFileViewer,
  } = useFileViewer({
    workspaceFileService,
    serverConfig,
  });

  const onFileSelectFromSidebar = useCallback(
    (path: string) => {
      triggerHaptic("selection");
      openFile(path);
    },
    [openFile]
  );

  const fetchWorkspacePath = useCallback(() => {
    setWorkspacePathLoading(true);
    fetch(`${serverConfig.getBaseUrl()}/api/workspace-path`)
      .then((res) => res.json())
      .then((data) => setWorkspacePath(data?.path ?? null))
      .catch(() => setWorkspacePath(null))
      .finally(() => setWorkspacePathLoading(false));
  }, [serverConfig]);

  useEffect(() => {
    fetchWorkspacePath();
  }, [fetchWorkspacePath]);

  const onFileSelectFromChat = useCallback((path: string) => {
    triggerHaptic("selection");

    void (async () => {
      const raw = typeof path === "string" ? path.trim() : "";
      if (!raw) return;
      const normalized = normalizePathSeparators(raw);

      if (!isAbsolutePath(normalized)) {
        openFile(normalized.replace(/^\/+/, ""));
        return;
      }

      try {
        const baseUrl = serverConfig.getBaseUrl();
        const wsRes = await fetch(`${baseUrl}/api/workspace-path`);
        const wsData = (await wsRes.json()) as { path?: string };
        if (typeof wsData?.path === "string") {
          setWorkspacePath(wsData.path);
          const rel = toWorkspaceRelativePath(normalized, wsData.path);
          if (rel != null) {
            openFile(rel || basename(normalized));
            return;
          }
        }

        const targetWorkspace = dirname(normalized);
        const switchRes = await fetch(`${baseUrl}/api/workspace-path`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: targetWorkspace }),
        });
        if (switchRes.ok) {
          const switched = (await switchRes.json()) as { path?: string };
          if (typeof switched?.path === "string") {
            setWorkspacePath(switched.path);
          }
          openFile(basename(normalized));
          return;
        }
      } catch {
        // Fall back.
      }

      openFile(normalized);
    })();
  }, [serverConfig, openFile]);

  const handleWorkspaceSelectedFromPicker = useCallback(
    (path?: string) => {
      onWorkspaceSelectedFromPicker?.(path);
    },
    [onWorkspaceSelectedFromPicker]
  );

  const switchWorkspaceForSession = useCallback(async (workspacePathToSwitch: string) => {
    try {
      const baseUrl = serverConfig.getBaseUrl();
      const switchRes = await fetch(`${baseUrl}/api/workspace-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: workspacePathToSwitch }),
      });
      if (!switchRes.ok) return;
      const data = (await switchRes.json()) as { path?: string };
      if (typeof data?.path === "string") {
        setWorkspacePath(data.path);
      }
    } catch {
      // Ignore workspace switch failures.
    }
  }, [serverConfig]);

  const state: WorkspaceFileControllerState = {
    workspacePath,
    workspacePathLoading,
    selectedFilePath,
    fileContent,
    fileIsImage,
    fileLoading,
    fileError,
    onFileSelectFromSidebar,
    onFileSelectFromChat,
    onCloseFileViewer: closeFileViewer,
    fetchWorkspacePath,
    onWorkspaceSelectedFromPicker: handleWorkspaceSelectedFromPicker,
    switchWorkspaceForSession,
  };

  return <>{children(state)}</>;
}
