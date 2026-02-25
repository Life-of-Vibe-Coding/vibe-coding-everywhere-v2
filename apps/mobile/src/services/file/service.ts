import type { IServerConfig, IWorkspaceFileService } from "@/core/types";

/**
 * Default workspace file service using fetch + ServerConfig (Dependency Injection).
 * App receives IWorkspaceFileService so it can be replaced in tests or for other backends.
 */
export function createWorkspaceFileService(serverConfig: IServerConfig): IWorkspaceFileService {
  return {
    async fetchFile(path: string): Promise<{ content: string | null; isImage: boolean }> {
      const baseUrl = serverConfig.getBaseUrl();
      const url = `${baseUrl}/api/workspace-file?path=${encodeURIComponent(path)}`;
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        let errMsg = res.statusText;
        try {
          const b = JSON.parse(text) as { error?: string };
          if (typeof b?.error === "string") errMsg = b.error;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }
      const data = JSON.parse(text) as { content?: string; isImage?: boolean };
      const raw = data?.content;
      const content = typeof raw === "string" ? raw : raw != null ? String(raw) : null;
      return { content, isImage: data?.isImage === true };
    },
  };
}
