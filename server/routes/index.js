/**
 * Express routes for the server.
 * 
 * Defines all HTTP endpoints for:
 * - Server configuration
 * - Workspace file tree browsing
 * - File content retrieval
 * - Raw file serving for previews
 */
import fs from "fs";
import path from "path";
import { SIDEBAR_REFRESH_INTERVAL_MS, getWorkspaceCwd, setWorkspaceCwd, WORKSPACE_ALLOWED_ROOT, SKILLS_DIR, projectRoot } from "../config/index.js";
import { buildWorkspaceTree, IMAGE_EXT, MAX_TEXT_FILE_BYTES } from "../utils/index.js";
import { discoverSkills, getSkillContent, getSkillChildren, getEnabledIds, setEnabledIds, resolveAgentDir } from "../skills/index.js";

/**
 * Configure all Express routes on the given app instance.
 * @param {import('express').Application} app - Express application
 */
export function setupRoutes(app) {
  // API request logging middleware - logs all API calls with timestamp and status
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      const ts = new Date().toISOString();
      console.log(`[API] ${ts} ${req.method} ${req.path}`, req.query && Object.keys(req.query).length ? req.query : "");
      res.on("finish", () => {
        console.log(`[API] ${ts} ${req.method} ${req.path} -> ${res.statusCode}`);
      });
    }
    next();
  });

  /**
   * GET /api/config
   * Returns server configuration for client initialization.
   * Used by mobile app to know refresh intervals.
   */
  app.get("/api/config", (_, res) => {
    res.json({
      sidebarRefreshIntervalMs: SIDEBAR_REFRESH_INTERVAL_MS,
    });
  });

  /**
   * GET /api/workspace-path
   * Returns the absolute path to the current workspace directory and allowed root for workspace selection.
   * Used by clients to display current project location and to build workspace picker.
   */
  app.get("/api/workspace-path", (_, res) => {
    res.json({ path: getWorkspaceCwd(), allowedRoot: WORKSPACE_ALLOWED_ROOT });
  });

  /**
   * POST /api/workspace-path
   * Set workspace directory at runtime. Body: { path: string }. Path must be under WORKSPACE_ALLOWED_ROOT.
   */
  app.post("/api/workspace-path", (req, res) => {
    const raw = req.body?.path ?? req.query?.path;
    const result = setWorkspaceCwd(raw);
    if (result.ok) {
      res.json({ path: getWorkspaceCwd() });
    } else {
      res.status(400).json({ error: result.error });
    }
  });

  /**
   * GET /api/skills
   * List discoverable skills (scan skills/ subdirs for SKILL.md, parse frontmatter).
   */
  app.get("/api/skills", (_, res) => {
    try {
      const data = discoverSkills(SKILLS_DIR);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to list skills" });
    }
  });

  /**
   * GET /api/skills/:id/children?path=...
   * Return children of a subfolder within a skill (for expandable folder trees).
   * Must be registered before /api/skills/:id to match correctly.
   */
  app.get("/api/skills/:id/children", (req, res) => {
    const id = req.params?.id;
    const relPath = typeof req.query?.path === "string" ? req.query.path : "";
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing or invalid skill id" });
    }
    try {
      const data = getSkillChildren(id, relPath, SKILLS_DIR);
      if (!data) {
        return res.status(404).json({ error: "Path not found" });
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to load children" });
    }
  });

  /**
   * GET /api/skills/:id
   * Return full SKILL.md content for a single skill.
   */
  app.get("/api/skills/:id", (req, res) => {
    const id = req.params?.id;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing or invalid skill id" });
    }
    try {
      const data = getSkillContent(id, SKILLS_DIR);
      if (!data) {
        return res.status(404).json({ error: "Skill not found" });
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to load skill" });
    }
  });

  /**
   * GET /api/skills-enabled
   * Return enabled skill IDs from persistence.
   */
  app.get("/api/skills-enabled", (_, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const agentDir = resolveAgentDir(cwd, projectRoot);
      const enabledIds = getEnabledIds(agentDir);
      res.json({ enabledIds });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to get enabled skills" });
    }
  });

  /**
   * POST /api/skills-enabled
   * Update enabled skill IDs. Body: { enabledIds: string[] }
   */
  app.post("/api/skills-enabled", (req, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const agentDir = resolveAgentDir(cwd, projectRoot);
      const enabledIds = Array.isArray(req.body?.enabledIds) ? req.body.enabledIds : [];
      const result = setEnabledIds(agentDir, enabledIds);
      if (result.ok) {
        res.json({ enabledIds: getEnabledIds(agentDir) });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to update enabled skills" });
    }
  });

  /**
   * GET /api/workspace-allowed-children
   * Returns list of direct child directories of the allowed root (or a subpath) for workspace selection.
   * Query: parent (optional) - path relative to allowed root, e.g. "" or "machine_learning"
   */
  app.get("/api/workspace-allowed-children", (req, res) => {
    try {
      const parent = typeof req.query.parent === "string" ? req.query.parent.replace(/^\/+/, "") : "";
      const dir = parent ? path.join(WORKSPACE_ALLOWED_ROOT, parent) : WORKSPACE_ALLOWED_ROOT;
      if (!dir.startsWith(WORKSPACE_ALLOWED_ROOT)) {
        return res.status(403).json({ error: "Path outside allowed root" });
      }
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return res.json({ children: [] });
      }
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const children = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: path.join(dir, e.name) }));
      res.json({ children });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to list directories" });
    }
  });

  /**
   * GET /api/workspace-tree
   * Returns the recursive file tree of the workspace.
   * Used by sidebar to show folder structure.
   * Each node has: name, path, type (file|folder), children (for folders)
   */
  app.get("/api/workspace-tree", (_, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const tree = buildWorkspaceTree(cwd);
      res.json({ root: path.basename(cwd), tree });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to read workspace" });
    }
  });

  /**
   * GET /api/preview-raw
   * Serve raw workspace files for preview (HTML, CSS, JS, etc.)
   * Returns files with appropriate Content-Type headers.
   * Security: Path is normalized and checked to stay within workspace.
   * 
   * Query params:
   *   - path: Relative path to file within workspace
   */
  app.get("/api/preview-raw", (req, res) => {
    const relPath = req.query.path;
    if (typeof relPath !== "string" || !relPath.trim()) {
      return res.status(400).send("Missing or invalid path");
    }
    try {
      // Normalize path and prevent directory traversal attacks
      const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^\//, "");
      const cwd = getWorkspaceCwd();
      const fullPath = path.join(cwd, normalized);
      
      // Security check: ensure path stays within workspace
      if (!fullPath.startsWith(cwd)) {
        return res.status(403).send("Path outside workspace");
      }
      
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return res.status(400).send("Not a file");
      
      // Determine MIME type based on file extension
      const ext = path.extname(normalized).toLowerCase().replace(/^\./, "");
      const mime = ext === "html" || ext === "htm" ? "text/html" : 
                   ext === "css" ? "text/css" : 
                   ext === "js" ? "application/javascript" : 
                   "application/octet-stream";
      
      res.setHeader("Content-Type", mime);
      res.sendFile(fullPath);
    } catch (err) {
      if (err.code === "ENOENT") return res.status(404).send("File not found");
      res.status(500).send(err.message || "Failed to serve file");
    }
  });

  /**
   * Serve workspace files at root path.
   * Allows URLs like http://host:PORT/abc.html to work for preview.
   * Falls through to next handler if file doesn't exist.
   * 
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  function serveWorkspaceFile(req, res, next) {
    // Default to index.html for root path
    const rawPath = (req.path || "/").replace(/^\//, "") || "index.html";
    
    // Normalize and prevent directory traversal
    const normalized = path.normalize(rawPath).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^\//, "");
    const cwd = getWorkspaceCwd();
    const fullPath = path.join(cwd, normalized);
    
    // Security check
    if (!fullPath.startsWith(cwd)) return next();
    
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return next();
      
      // Set appropriate Content-Type
      const ext = path.extname(normalized).toLowerCase().replace(/^\./, "");
      const mime = ext === "html" || ext === "htm" ? "text/html" : 
                   ext === "css" ? "text/css" : 
                   ext === "js" ? "application/javascript" : 
                   "application/octet-stream";
      
      res.setHeader("Content-Type", mime);
      res.sendFile(fullPath);
    } catch (err) {
      if (err.code === "ENOENT") return next();
      res.status(500).send(err.message || "Failed to serve file");
    }
  }

  /**
   * GET /api/workspace-file
   * Returns file content as JSON.
   * Images are returned as base64-encoded strings.
   * Text files have size limits to prevent UI freezing.
   * 
   * Query params:
   *   - path: Relative path to file within workspace
   */
  app.get("/api/workspace-file", (req, res) => {
    const relPath = req.query.path;
    if (typeof relPath !== "string" || !relPath.trim()) {
      return res.status(400).json({ error: "Missing or invalid path" });
    }
    try {
      // Normalize path
      const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
      const cwd = getWorkspaceCwd();
      const fullPath = path.join(cwd, normalized);
      
      // Security check
      if (!fullPath.startsWith(cwd)) {
        return res.status(403).json({ error: "Path outside workspace" });
      }
      
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        return res.status(400).json({ error: "Not a file" });
      }
      
      // Check if it's an image file
      const ext = path.extname(normalized).toLowerCase().replace(/^\./, "");
      const isImage = IMAGE_EXT.has(ext);
      
      if (isImage) {
        // Return images as base64
        const buffer = fs.readFileSync(fullPath);
        const content = buffer.toString("base64");
        res.json({ path: normalized, content, isImage: true });
      } else {
        // Check file size limit for text files
        if (stat.size > MAX_TEXT_FILE_BYTES) {
          return res.status(413).json({
            error: `File too large to display (${Math.round(stat.size / 1024)} KB, max ${Math.round(MAX_TEXT_FILE_BYTES / 1024)} KB). Try a smaller file.`,
          });
        }
        // Return text content
        const content = fs.readFileSync(fullPath, "utf8");
        res.json({ path: normalized, content });
      }
    } catch (err) {
      if (err.code === "ENOENT") return res.status(404).json({ error: "File not found" });
      res.status(500).json({ error: err.message || "Failed to read file" });
    }
  });

  // Catch-all for non-API paths so /abc.html and /subdir/index.html work
  // Must be registered after all /api/* routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    serveWorkspaceFile(req, res, next);
  });
}
