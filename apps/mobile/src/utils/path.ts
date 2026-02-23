/**
 * Path utilities for cross-platform paths (no Node path dependency).
 * Normalizes backslashes to forward slashes for consistency.
 */

export function normalizePathSeparators(input: string): string {
  return input.replace(/\\/g, "/");
}

export function getFileName(path: string): string {
  const p = normalizePathSeparators(path).replace(/\/+$/, "");
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p || path;
}

export function dirname(input: string): string {
  const p = normalizePathSeparators(input).replace(/\/+$/, "");
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return p.startsWith("/") ? "/" : ".";
  return p.slice(0, idx);
}

/**
 * Parent directory of path. Returns "" for paths with no parent (e.g. "foo").
 * Used for filesystem navigation (e.g. "go up" from browse root).
 */
export function getDirname(p: string): string {
  const norm = normalizePathSeparators(p).replace(/\/+$/, "");
  const lastSlash = norm.lastIndexOf("/");
  if (lastSlash <= 0) return lastSlash === 0 ? "/" : "";
  return norm.slice(0, lastSlash) || "/";
}

export function basename(input: string): string {
  return getFileName(input);
}

export function isAbsolutePath(input: string): boolean {
  const p = normalizePathSeparators(input.trim());
  return p.startsWith("/") || /^[A-Za-z]:\//.test(p);
}

/**
 * Returns the path relative to workspaceRoot, or null if not under root.
 */
export function toWorkspaceRelativePath(inputPath: string, workspaceRoot: string): string | null {
  const file = normalizePathSeparators(inputPath).trim();
  const root = normalizePathSeparators(workspaceRoot).replace(/\/$/, "");
  if (!file || !root) return null;
  if (file === root) return "";
  if (!file.startsWith(root + "/")) return null;
  return file.slice(root.length + 1);
}

/**
 * Get relative path from root to fullPath. Returns fullPath if not under root.
 */
export function getRelativePath(fullPath: string, root: string): string {
  const rootNorm = normalizePathSeparators(root).replace(/\/$/, "");
  const fullNorm = normalizePathSeparators(fullPath).replace(/\/$/, "");
  if (fullNorm === rootNorm) return "";
  if (fullNorm.startsWith(rootNorm + "/")) {
    return fullNorm.slice(rootNorm.length + 1);
  }
  return fullPath;
}

/** Max chars for truncated path display. Keeps the line short on narrow screens. */
const PATH_DISPLAY_MAX = 38;

/**
 * Truncate long path to show only the tail (last segment or two).
 * Use when ellipsizeMode alone leaves the line too long.
 */
export function truncatePathForDisplay(path: string, maxChars: number = PATH_DISPLAY_MAX): string {
  const p = path.replace(/\/+$/, "");
  if (p.length <= maxChars) return p;
  const parts = p.split("/").filter(Boolean);
  if (parts.length <= 1) return p.length > maxChars ? `...${p.slice(-(maxChars - 3))}` : p;
  const tail = parts.slice(-2).join("/");
  return tail.length >= maxChars ? `.../${parts[parts.length - 1]}` : `.../${tail}`;
}

/**
 * Get parent path within root. Returns "" if at root, one level deep, or outside root.
 * Empty string means "parent is root" in path navigation state.
 */
export function getParentPath(path: string, root: string): string {
  const rootNorm = normalizePathSeparators(root).replace(/\/$/, "");
  const pathNorm = normalizePathSeparators(path).replace(/\/$/, "");
  if (!pathNorm || pathNorm === rootNorm || pathNorm.length <= rootNorm.length) return "";
  if (!pathNorm.startsWith(rootNorm + "/")) return "";
  const suffix = pathNorm.slice(rootNorm.length + 1);
  const idx = suffix.lastIndexOf("/");
  if (idx === -1) return "";
  return rootNorm + "/" + suffix.slice(0, idx);
}
