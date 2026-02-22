#!/usr/bin/env node
/**
 * Start Expo mobile app with server URL pointing to this machine via Tailscale.
 * Use this when running the app on a physical device that connects through a Tailscale tunnel.
 *
 * Resolves server URL in order:
 * 1. EXPO_PUBLIC_SERVER_URL env (user override)
 * 2. FUNNEL_SERVER_URL env (e.g. from .env)
 * 3. Tailscale IP from `tailscale status --json --self`
 * 4. Fails with instructions if Tailscale is not available
 *
 * Usage:
 *   npm run dev:mobile:funnel
 *   FUNNEL_SERVER_URL=http://yifans-macbook-pro.tail145574.ts.net:3456 npm run dev:mobile:funnel
 */
import "dotenv/config";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = process.env.PORT || 3456;

function getServerUrl() {
  const env = process.env.EXPO_PUBLIC_SERVER_URL;
  if (env) return env;

  const funnel = process.env.FUNNEL_SERVER_URL;
  if (funnel) {
    const base = funnel.replace(/\/$/, "");
    return /:\d+(\/|$)/.test(base) ? base : `${base}:${PORT}`;
  }

  try {
    const out = execSync("tailscale status --json --self 2>/dev/null", {
      encoding: "utf8",
      maxBuffer: 64 * 1024,
    });
    const json = JSON.parse(out);
    const ip = json?.TailscaleIPs?.[0] ?? json?.TailscaleIP;
    if (ip) {
      return `http://${ip}:${PORT}`;
    }
  } catch {
    // tailscale not running or not installed
  }

  console.error(`
Cannot resolve Tailscale URL. Options:

1. Ensure Tailscale is running: tailscale up

2. Set EXPO_PUBLIC_SERVER_URL explicitly:
   EXPO_PUBLIC_SERVER_URL=http://YOUR_MACHINE.tailnet.ts.net:${PORT} npm run dev:mobile:funnel
   # Or use your Tailscale IP (100.x.x.x):
   EXPO_PUBLIC_SERVER_URL=http://100.x.x.x:${PORT} npm run dev:mobile:funnel
`);
  process.exit(1);
}

const serverUrl = getServerUrl();
console.log(`Starting Expo with EXPO_PUBLIC_SERVER_URL=${serverUrl}`);
process.env.EXPO_PUBLIC_SERVER_URL = serverUrl;

const child = spawn("npm", ["run", "-w", "mobile", "start"], {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env, EXPO_PUBLIC_SERVER_URL: serverUrl },
});
child.on("exit", (code) => process.exit(code ?? 0));
