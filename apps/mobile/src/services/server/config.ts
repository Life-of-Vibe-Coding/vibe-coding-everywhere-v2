import type { IServerConfig } from "../../core/types";

/**
 * Default server config (env-based). Inject IServerConfig in tests or for different backends.
 */
function getBaseUrlFromEnv(): string {
  const url =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SERVER_URL
      ? process.env.EXPO_PUBLIC_SERVER_URL
      : "http://localhost:3456";
  return url.replace(/\/$/, "");
}

export function createDefaultServerConfig(): IServerConfig {
  return {
    getBaseUrl: getBaseUrlFromEnv,
    resolvePreviewUrl(previewUrl: string): string {
      try {
        const base = getBaseUrlFromEnv();
        const baseParsed = new URL(base);
        const parsed = new URL(previewUrl);
        // Only rewrite when preview is the same host+port as base (main app server). Otherwise keep as-is so e.g. port 8001 stays 8001 for both mobile and local.
        const basePort = baseParsed.port || (baseParsed.protocol === "https:" ? "443" : "80");
        const previewPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
        const isSameHost =
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === baseParsed.hostname;
        const isSamePort = previewPort === basePort;
        if (isSameHost && isSamePort) {
          const pathname = (parsed.pathname || "/").replace(/^\//, "") || "index.html";
          const cleanUrl = `${base.replace(/\/$/, "")}/${pathname}${parsed.search || ""}${parsed.hash || ""}`;
          console.log("[PreviewURL] resolvePreviewUrl: base=" + base + " | incoming=" + previewUrl + " | resolved=" + cleanUrl);
          return cleanUrl;
        }
        // Different port: port-to-port — replace localhost with a host the device can reach. When base is localhost, device cannot reach Mac; use EXPO_PUBLIC_PREVIEW_HOST (e.g. Tailscale host) if set.
        const isPreviewLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        if (isPreviewLocalhost && baseParsed.hostname) {
          const baseIsLocal = baseParsed.hostname === "localhost" || baseParsed.hostname === "127.0.0.1";
          const previewHostRaw = typeof process !== "undefined" ? (process.env.EXPO_PUBLIC_PREVIEW_HOST ?? "").trim() : "";
          let portToPortHost = baseParsed.hostname;
          if (baseIsLocal && previewHostRaw) {
            try {
              portToPortHost = new URL(previewHostRaw.startsWith("http") ? previewHostRaw : `http://${previewHostRaw}`).hostname;
            } catch {
              portToPortHost = previewHostRaw;
            }
          }
          const portSuffix = parsed.port ? `:${parsed.port}` : "";
          const rewritten = `${baseParsed.protocol}//${portToPortHost}${portSuffix}${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
          console.log("[PreviewURL] resolvePreviewUrl: port-to-port | incoming=" + previewUrl + " | resolved=" + rewritten);
          return rewritten;
        }
        console.log("[PreviewURL] resolvePreviewUrl: keep as-is | incoming=" + previewUrl);
        return previewUrl;
      } catch (e) {
        console.log("[PreviewURL] resolvePreviewUrl: parse error, using as-is | incoming=" + previewUrl + " | error=" + String(e));
        return previewUrl;
      }
    },
  };
}

/** Singleton default for app use when no DI container is used. */
let defaultInstance: IServerConfig | null = null;

export function getDefaultServerConfig(): IServerConfig {
  if (!defaultInstance) defaultInstance = createDefaultServerConfig();
  return defaultInstance;
}
