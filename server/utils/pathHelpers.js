/**
 * Path and file utilities for server routes.
 * Centralizes path normalization and security checks to prevent directory traversal.
 */
import path from "path";

/** Pattern to strip leading directory traversal segments. */
const TRAVERSAL_STRIP = /^(\.\.(\/|\\|$))+/;

/**
 * Normalize a relative path and strip directory traversal attempts.
 * @param {string} relPath - Relative path from request
 * @returns {string} Sanitized path safe for joining with workspace root
 */
export function normalizeRelativePath(relPath) {
  if (typeof relPath !== "string" || !relPath.trim()) return "";
  const normalized = path.normalize(relPath).replace(TRAVERSAL_STRIP, "").replace(/^[/\\]+/, "");
  return normalized;
}

/**
 * Resolve and validate that a path stays within a root directory.
 * @param {string} rootDir - Absolute root path (e.g. workspace cwd)
 * @param {string} relativePath - Path relative to root
 * @returns {{ ok: boolean; fullPath?: string; error?: string }}
 */
export function resolveWithinRoot(rootDir, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const fullPath = path.resolve(path.join(rootDir, normalized));
  const rootNorm = path.resolve(rootDir).replace(/\/$/, "") || path.resolve(rootDir);

  if (fullPath !== rootNorm && !fullPath.startsWith(rootNorm + path.sep)) {
    return { ok: false, error: "Path outside root" };
  }
  return { ok: true, fullPath };
}

/**
 * Map file extension to MIME type for common web formats.
 * @param {string} filename - Filename or path
 * @returns {string} MIME type
 */
export function getMimeForFile(filename) {
  const ext = path.extname(filename).toLowerCase().replace(/^\./, "");
  const mimeMap = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}
