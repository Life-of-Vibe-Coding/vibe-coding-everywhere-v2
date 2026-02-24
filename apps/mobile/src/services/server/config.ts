import type { IServerConfig } from "../../core/types";

/**
 * Connection mode for the mobile app.
 *   - "direct"   : Direct URL connection (localhost, LAN, etc.)
 *   - "ziti"     : OpenZiti overlay — base URL goes through Ziti proxy with X-Target-Port
 *   - "ziti-sdk" : OpenZiti embedded SDK (future) — local proxy on device
 */
type ConnectionMode = "direct" | "ziti" | "ziti-sdk";

function getConnectionMode(): ConnectionMode {
  const mode =
    typeof process !== "undefined" ? (process.env?.EXPO_PUBLIC_CONNECTION_MODE ?? "").trim().toLowerCase() : "";
  if (mode === "ziti" || mode === "ziti-sdk" || mode === "direct") {
    return mode as ConnectionMode;
  }
  return "direct";
}

/**
 * Get the Ziti proxy port (used for X-Target-Port based routing).
 * When using Ziti, the reverse proxy on the Mac routes based on this header.
 */
function getZitiProxyPort(): number {
  const port =
    typeof process !== "undefined" ? (process.env?.EXPO_PUBLIC_ZITI_PROXY_PORT ?? "").trim() : "";
  return port ? parseInt(port, 10) || 9443 : 9443;
}

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
  const connectionMode = getConnectionMode();

  return {
    getBaseUrl: getBaseUrlFromEnv,
    resolvePreviewUrl(previewUrl: string): string {
      try {
        const base = getBaseUrlFromEnv();
        const baseParsed = new URL(base);
        const parsed = new URL(previewUrl);

        // ── Ziti mode: preview URLs route through the same Ziti proxy ──
        // The reverse proxy on the Mac uses X-Target-Port to forward to the right port.
        // For WebView, we can't set custom headers, so we use a query parameter
        // that the proxy can also read: ?_targetPort=<port>
        if (connectionMode === "ziti" || connectionMode === "ziti-sdk") {
          const isPreviewLocalhost =
            parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
          const basePort = baseParsed.port || (baseParsed.protocol === "https:" ? "443" : "80");
          const previewPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");

          if (isPreviewLocalhost) {
            // Rewrite the URL to go through the Ziti proxy base URL
            // The proxy will forward based on the _targetPort query param
            const targetPort = previewPort !== basePort ? previewPort : basePort;
            const proxyUrl = new URL(base);
            proxyUrl.pathname = parsed.pathname || "/";
            proxyUrl.search = parsed.search || "";
            proxyUrl.hash = parsed.hash || "";

            // Add target port hint for the proxy (only if different from default)
            if (targetPort !== basePort) {
              proxyUrl.searchParams.set("_targetPort", targetPort);
            }

            const resolved = proxyUrl.toString();
            console.log(
              "[PreviewURL] resolvePreviewUrl (ziti): incoming=" +
                previewUrl +
                " | resolved=" +
                resolved
            );
            return resolved;
          }

          // Non-localhost preview URL: keep as-is (external service)
          console.log("[PreviewURL] resolvePreviewUrl (ziti): keep as-is | incoming=" + previewUrl);
          return previewUrl;
        }

        // ── Direct mode ──
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
        // Different port: port-to-port — replace localhost with a host the device can reach.
        // When base is localhost, device cannot reach Mac; use EXPO_PUBLIC_PREVIEW_HOST if set.
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

/** Expose connection mode for UI components that need to adapt (e.g. UrlChoiceModal). */
export function getConnectionModeForUI(): ConnectionMode {
  return getConnectionMode();
}
