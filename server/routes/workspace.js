/**
 * Workspace file tree, content, and preview routes.
 */
import fs from "fs";
import path from "path";
import { getWorkspaceCwd, WORKSPACE_ALLOWED_ROOT } from "../config/index.js";
import {
    buildWorkspaceTree, getMimeForFile, IMAGE_EXT,
    MAX_TEXT_FILE_BYTES,
    resolveWithinRoot
} from "../utils/index.js";

export function registerWorkspaceRoutes(app) {
  app.get("/api/workspace-allowed-children", handleWorkspaceAllowedChildren);
  app.get("/api/workspace-tree", handleWorkspaceTree);
  app.get("/api/preview-raw", handlePreviewRaw);
  app.get("/api/workspace-file", handleWorkspaceFile);
  app.post("/api/workspace/create-folder", handleWorkspaceCreateFolder);
}

function handleWorkspaceCreateFolder(req, res) {
  try {
    const base = req.body.base === "os" ? "os" : "workspace";
    let rootDir;
    if (base === "os") {
      rootDir = path.resolve("/");
    } else if (typeof req.body.root === "string" && req.body.root.trim()) {
      const candidate = path.resolve(req.body.root.trim());
      if (!candidate.startsWith(WORKSPACE_ALLOWED_ROOT) && candidate !== WORKSPACE_ALLOWED_ROOT) {
        return res.status(403).json({ error: "Root must be under allowed workspace" });
      }
      rootDir = candidate;
    } else {
      rootDir = getWorkspaceCwd();
    }

    let parent = typeof req.body.parent === "string"
      ? req.body.parent.replace(/^\/+/, "").replace(/\\/g, "/")
      : "";
    if (parent.includes("..")) {
      return res.status(400).json({ error: "Invalid path" });
    }

    const { name } = req.body;
    if (typeof name !== "string" || !name.trim() || name.includes("/") || name.includes("\\") || name === ".." || name === ".") {
      return res.status(400).json({ error: "Invalid folder name" });
    }

    const dir = parent ? path.join(rootDir, parent) : rootDir;
    const resolvedDir = path.resolve(dir);

    // Check inside allowed roots
    const rootNorm = rootDir.replace(/\/$/, "") || rootDir;
    if (resolvedDir !== rootNorm && !resolvedDir.startsWith(rootNorm + path.sep)) {
      return res.status(403).json({ error: "Path outside root" });
    }
    if (base !== "os" && !resolvedDir.startsWith(WORKSPACE_ALLOWED_ROOT) && resolvedDir !== WORKSPACE_ALLOWED_ROOT) {
      return res.status(403).json({ error: "Path outside allowed workspace" });
    }

    const targetFolder = path.join(resolvedDir, name);
    if (fs.existsSync(targetFolder)) {
      return res.status(400).json({ error: "Folder already exists" });
    }

    fs.mkdirSync(targetFolder, { recursive: true });
    res.json({ success: true, path: targetFolder });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create folder" });
  }
}

export function createServeWorkspaceFileMiddleware() {
  return function serveWorkspaceFile(req, res, next) {
    const rawPath = (req.path || "/").replace(/^\//, "") || "index.html";
    const cwd = getWorkspaceCwd();
    const { ok, fullPath } = resolveWithinRoot(cwd, rawPath);
    if (!ok || !fullPath) return next();

    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return next();

      res.setHeader("Content-Type", getMimeForFile(fullPath));
      res.sendFile(fullPath);
    } catch (err) {
      if (err.code === "ENOENT") return next();
      res.status(500).send(err.message || "Failed to serve file");
    }
  };
}

function handleWorkspaceAllowedChildren(req, res) {
  try {
    const base = req.query.base === "os" ? "os" : "workspace";
    let rootDir;
    if (base === "os") {
      rootDir = path.resolve("/");
    } else if (typeof req.query.root === "string" && req.query.root.trim()) {
      const candidate = path.resolve(req.query.root.trim());
      if (!candidate.startsWith(WORKSPACE_ALLOWED_ROOT) && candidate !== WORKSPACE_ALLOWED_ROOT) {
        return res.status(403).json({ error: "Root must be under allowed workspace" });
      }
      if (!fs.existsSync(candidate)) {
        return res.status(404).json({ error: "Path not found on server", children: [] });
      }
      if (!fs.statSync(candidate).isDirectory()) {
        return res.status(400).json({ error: "Not a directory", children: [] });
      }
      rootDir = candidate;
    } else {
      rootDir = getWorkspaceCwd();
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[workspace-allowed-children] rootDir=%s parent=%s", rootDir, req.query.parent ?? "(root)");
    }

    let parent = typeof req.query.parent === "string"
      ? req.query.parent.replace(/^\/+/, "").replace(/\\/g, "/")
      : "";
    if (parent.includes("..")) {
      return res.status(400).json({ error: "Invalid path" });
    }

    const dir = parent ? path.join(rootDir, parent) : rootDir;
    const resolvedDir = path.resolve(dir);
    const rootNorm = rootDir.replace(/\/$/, "") || rootDir;
    if (resolvedDir !== rootNorm && !resolvedDir.startsWith(rootNorm + path.sep)) {
      return res.status(403).json({ error: "Path outside root" });
    }
    if (base !== "os" && !resolvedDir.startsWith(WORKSPACE_ALLOWED_ROOT) && resolvedDir !== WORKSPACE_ALLOWED_ROOT) {
      return res.status(403).json({ error: "Path outside allowed workspace" });
    }
    if (!fs.existsSync(resolvedDir)) {
      return res.status(404).json({ error: "Path not found on server", children: [] });
    }
    if (!fs.statSync(resolvedDir).isDirectory()) {
      return res.status(400).json({ error: "Not a directory", children: [] });
    }

    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const children = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: path.join(resolvedDir, e.name) }));
    res.json({ children });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list directories" });
  }
}

function handleWorkspaceTree(_, res) {
  try {
    const cwd = getWorkspaceCwd();
    const tree = buildWorkspaceTree(cwd);
    res.json({ root: path.basename(cwd), tree });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to read workspace" });
  }
}

function handlePreviewRaw(req, res) {
  const relPath = req.query.path;
  if (typeof relPath !== "string" || !relPath.trim()) {
    return res.status(400).send("Missing or invalid path");
  }
  try {
    const cwd = getWorkspaceCwd();
    const { ok, fullPath, error } = resolveWithinRoot(cwd, relPath);
    if (!ok || !fullPath) {
      return res.status(403).send(error || "Path outside workspace");
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return res.status(400).send("Not a file");

    res.setHeader("Content-Type", getMimeForFile(fullPath));
    res.sendFile(fullPath);
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).send("File not found");
    res.status(500).send(err.message || "Failed to serve file");
  }
}

function handleWorkspaceFile(req, res) {
  const relPath = req.query.path;
  if (typeof relPath !== "string" || !relPath.trim()) {
    return res.status(400).json({ error: "Missing or invalid path" });
  }
  try {
    const cwd = getWorkspaceCwd();
    const { ok, fullPath, error } = resolveWithinRoot(cwd, relPath);
    if (!ok || !fullPath) {
      return res.status(403).json({ error: error || "Path outside workspace" });
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: "Not a file" });
    }

    const ext = path.extname(fullPath).toLowerCase().replace(/^\./, "");
    const isImage = IMAGE_EXT.has(ext);
    const relPathForResponse = path.relative(cwd, fullPath).replace(/\\/g, "/");

    if (isImage) {
      const buffer = fs.readFileSync(fullPath);
      const content = buffer.toString("base64");
      res.json({ path: relPathForResponse, content, isImage: true });
    } else {
      if (stat.size > MAX_TEXT_FILE_BYTES) {
        return res.status(413).json({
          error: `File too large to display (${Math.round(stat.size / 1024)} KB, max ${Math.round(MAX_TEXT_FILE_BYTES / 1024)} KB). Try a smaller file.`,
        });
      }
      const content = fs.readFileSync(fullPath, "utf8");
      res.json({ path: relPathForResponse, content });
    }
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    res.status(500).json({ error: err.message || "Failed to read file" });
  }
}
