/**
 * Utility functions for the server.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/** Cached preview host (Tailscale or PREVIEW_HOST) for system prompt substitution. */
let cachedPreviewHost = null;

/**
 * Get the preview host for this session (Tailscale hostname or env).
 * Used to inject into system prompt so the agent outputs URLs the mobile client can open.
 * @returns {string} Hostname (e.g. your-machine.tail123456.ts.net) or "(not set)" if unavailable
 */
export function getPreviewHost() {
  if (cachedPreviewHost !== null) return cachedPreviewHost;
  const fromEnv = (process.env.PREVIEW_HOST || process.env.TAILSCALE_PREVIEW_HOST || "").trim();
  if (fromEnv) {
    try {
      const u = fromEnv.startsWith("http") ? fromEnv : `http://${fromEnv}`;
      cachedPreviewHost = new URL(u).hostname;
      return cachedPreviewHost;
    } catch {
      cachedPreviewHost = fromEnv;
      return cachedPreviewHost;
    }
  }
  try {
    const stdout = execSync("tailscale status --json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 64 * 1024,
    });
    const payload = JSON.parse(stdout);
    const self = payload?.Self;
    if (self && typeof self === "object") {
      if (typeof self.DNSName === "string" && self.DNSName.trim()) {
        cachedPreviewHost = self.DNSName.replace(/\.$/, "").trim();
        return cachedPreviewHost;
      }
      if (Array.isArray(self.TailscaleIPs) && self.TailscaleIPs.length) {
        const ip = self.TailscaleIPs.find((x) => typeof x === "string" && x.trim());
        if (ip) {
          cachedPreviewHost = ip.trim();
          return cachedPreviewHost;
        }
      }
    }
  } catch (_) {
    // Tailscale not installed, not running, or parse error
  }
  cachedPreviewHost = "(not set)";
  return cachedPreviewHost;
}

const ANSI_REGEX =
  /\x1B\[[0-9;?]*[ -/]*[@-~]|\x1B\][^\x07]*(?:\x07|\x1B\\)|\x1B[@-_]|\x1B.|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

export function stripAnsi(str) {
  if (typeof str !== "string") return "";
  return str.replace(ANSI_REGEX, "");
}

/** Kill any process listening on the given port (e.g. leftover from Claude verification). No-op if port invalid or none bound. */
export function killProcessOnPort(port) {
  const p = parseInt(port, 10);
  if (!Number.isInteger(p) || p <= 0 || p > 65535) return;
  try {
    const pidList = execSync(`lsof -ti :${p}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (pidList) {
      execSync(`kill -9 ${pidList.split(/\s+/).join(" ")}`, { stdio: "ignore" });
    }
  } catch (_) {
    // No process on port or lsof/kill not available
  }
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".idea", ".vscode", "dist", "build", "out",
  ".cache", "coverage", ".nyc_output", ".expo"
]);

export function buildWorkspaceTree(dirPath, basePath = "") {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === "Thumbs.db") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      try {
        const children = buildWorkspaceTree(fullPath, relPath);
        items.push({ name: entry.name, path: relPath, type: "folder", children });
      } catch (_) {
        items.push({ name: entry.name, path: relPath, type: "folder", children: [] });
      }
    } else {
      items.push({ name: entry.name, path: relPath, type: "file" });
    }
  }
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return items;
}

export const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"]);
export const MAX_TEXT_FILE_BYTES = 512 * 1024; // 500 KB - prevents huge files like package-lock.json from freezing the viewer
