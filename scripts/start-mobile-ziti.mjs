#!/usr/bin/env node
/**
 * Start Expo mobile app with Ziti overlay network connection.
 *
 * The Ziti approach uses the reverse proxy on the Mac (port 9443) to multiplex
 * all traffic (main server + preview ports) through a single endpoint. The mobile
 * app connects to the proxy, which routes based on X-Target-Port header or
 * _targetPort query parameter.
 *
 * Resolves connection config in order:
 * 1. EXPO_PUBLIC_SERVER_URL env (user override)
 * 2. ZITI_EDGE_ROUTER_URL env (Ziti edge router public URL)
 * 3. Ziti client identity file → LAN IP + proxy port (pre-SDK testing)
 * 4. Auto-detect Mac LAN IP → proxy port (no Ziti network needed)
 *
 * Environment:
 *   EXPO_PUBLIC_SERVER_URL       - Direct URL override (bypass Ziti)
 *   ZITI_EDGE_ROUTER_URL         - Public URL of the Ziti edge router
 *   ZITI_CLIENT_IDENTITY         - Path to client identity JSON for SDK embedding
 *   ZITI_PROXY_PORT               - Port the reverse proxy listens on (default: 9443)
 *   EXPO_PUBLIC_CONNECTION_MODE  - "ziti" | "ziti-sdk" | "direct" (auto-detected)
 *
 * Usage:
 *   npm run dev:mobile:ziti
 *   ZITI_EDGE_ROUTER_URL=https://your-router.example.com npm run dev:mobile:ziti
 */
import "dotenv/config";
import { execSync, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { networkInterfaces } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = process.env.PORT || 3456;
const ZITI_PROXY_PORT = process.env.ZITI_PROXY_PORT || "9443";

/**
 * Auto-detect the Mac's LAN IPv4 address.
 * Tries en0 (Wi-Fi) first, then any non-internal IPv4 interface.
 */
function getLanIp() {
  const nets = networkInterfaces();
  // Prefer en0 (Wi-Fi on macOS)
  for (const name of ["en0", "en1", "eth0", "wlan0"]) {
    const addrs = nets[name];
    if (addrs) {
      const v4 = addrs.find((a) => a.family === "IPv4" && !a.internal);
      if (v4) return v4.address;
    }
  }
  // Fallback: any non-internal IPv4
  for (const addrs of Object.values(nets)) {
    if (!addrs) continue;
    const v4 = addrs.find((a) => a.family === "IPv4" && !a.internal);
    if (v4) return v4.address;
  }
  return null;
}

function getZitiConfig() {
  // 1. Direct URL override
  const directUrl = process.env.EXPO_PUBLIC_SERVER_URL;
  if (directUrl) {
    return {
      serverUrl: directUrl,
      connectionMode: "direct",
      proxyPort: ZITI_PROXY_PORT,
    };
  }

  // 2. Ziti edge router URL (app connects through this)
  const edgeRouterUrl = process.env.ZITI_EDGE_ROUTER_URL;
  if (edgeRouterUrl) {
    const base = edgeRouterUrl.replace(/\/$/, "");
    return {
      serverUrl: base,
      connectionMode: "ziti",
      proxyPort: ZITI_PROXY_PORT,
    };
  }

  // 3. Client identity file exists → use LAN IP + proxy port for pre-SDK testing
  const defaultIdentityPath = join(ROOT, ".ziti", "identities", "vibe-client.json");
  const identityPath = process.env.ZITI_CLIENT_IDENTITY || defaultIdentityPath;

  if (existsSync(identityPath)) {
    try {
      const identity = JSON.parse(readFileSync(identityPath, "utf8"));
      const ztAPI = identity?.ztAPI || "(unknown)";
      console.log(`[ziti] Client identity found: ${identityPath}`);
      console.log(`[ziti] Controller API: ${ztAPI}`);
    } catch {
      console.log(`[ziti] Client identity found: ${identityPath}`);
    }

    // Until the Ziti SDK is embedded in the app, the phone can't use 127.0.0.1.
    // Fall back to LAN IP so the device can reach the proxy over the local network.
    const lanIp = getLanIp();
    if (lanIp) {
      console.log(`[ziti] SDK not yet embedded — using LAN IP fallback: ${lanIp}`);
      return {
        serverUrl: `http://${lanIp}:${ZITI_PROXY_PORT}`,
        connectionMode: "ziti",
        proxyPort: ZITI_PROXY_PORT,
        identityPath,
      };
    }

    // No LAN IP found (unlikely) — use localhost (works in simulator only)
    console.warn(`[ziti] WARNING: No LAN IP found. Using localhost (simulator only).`);
    return {
      serverUrl: `http://127.0.0.1:${ZITI_PROXY_PORT}`,
      connectionMode: "ziti-sdk",
      proxyPort: ZITI_PROXY_PORT,
      identityPath,
    };
  }

  // 4. No identity, no edge router URL — try LAN IP + proxy port anyway
  const lanIp = getLanIp();
  if (lanIp) {
    console.log(`[ziti] No Ziti identity found. Using LAN IP + proxy port.`);
    console.log(`[ziti] Make sure the proxy is running: npm run ziti:proxy`);
    return {
      serverUrl: `http://${lanIp}:${ZITI_PROXY_PORT}`,
      connectionMode: "ziti",
      proxyPort: ZITI_PROXY_PORT,
    };
  }

  console.error(`
Cannot resolve Ziti connection. Options:

1. Set the Ziti edge router URL:
   ZITI_EDGE_ROUTER_URL=https://your-router.example.com npm run dev:mobile:ziti

2. Ensure client identity exists:
   Run: ./scripts/setup-ziti-network.sh
   Expected: .ziti/identities/vibe-client.json

3. Set EXPO_PUBLIC_SERVER_URL directly:
   EXPO_PUBLIC_SERVER_URL=http://YOUR_IP:${PORT} npm run dev:mobile:ziti
`);
  process.exit(1);
}

const config = getZitiConfig();

console.log(`[ziti] Connection mode: ${config.connectionMode}`);
console.log(`[ziti] Server URL: ${config.serverUrl}`);
console.log(`[ziti] Proxy port: ${config.proxyPort}`);

const env = {
  ...process.env,
  EXPO_PUBLIC_SERVER_URL: config.serverUrl,
  EXPO_PUBLIC_CONNECTION_MODE: config.connectionMode,
  EXPO_PUBLIC_ZITI_PROXY_PORT: config.proxyPort,
};

if (config.identityPath) {
  env.EXPO_PUBLIC_ZITI_IDENTITY_PATH = config.identityPath;
}

const child = spawn("npm", ["run", "-w", "mobile", "start"], {
  stdio: "inherit",
  cwd: ROOT,
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));
