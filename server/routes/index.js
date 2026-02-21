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
import { SIDEBAR_REFRESH_INTERVAL_MS, getWorkspaceCwd, setWorkspaceCwd, WORKSPACE_ALLOWED_ROOT, SKILLS_DIR, projectRoot, ENABLE_DOCKER_MANAGER } from "../config/index.js";
import { buildWorkspaceTree, IMAGE_EXT, MAX_TEXT_FILE_BYTES } from "../utils/index.js";
import { discoverSkills, getSkillContent, getSkillChildren, getEnabledIds, setEnabledIds, resolveAgentDir } from "../skills/index.js";
import { getGitCommits, getGitTree, getGitStatus, gitAdd, gitCommit, gitPush, gitInit } from "../utils/git.js";
import { listProcessesOnPorts, killProcess, getLogTailByName, getLogTail } from "../utils/processes.js";
import * as dockerApi from "../docker/index.js";

/**
 * Configure all Express routes on the given app instance.
 * @param {import('express').Application} app - Express application
 */
export async function setupRoutes(app) {
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
    const cwd = getWorkspaceCwd();
    if (process.env.NODE_ENV !== "production") {
      // [DEBUG] Root cause: trace what the server returns
      console.log("[workspace-path] GET response:", {
        path: cwd,
        allowedRoot: WORKSPACE_ALLOWED_ROOT,
        workspaceRoot: cwd,
      });
    }
    res.json({
      path: cwd,
      allowedRoot: WORKSPACE_ALLOWED_ROOT,
      workspaceRoot: cwd,
    });
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
   * Returns list of direct child directories for workspace selection.
   * Query:
   *   root (optional) - absolute path to use as root (children of selected workspace). Must be under WORKSPACE_ALLOWED_ROOT.
   *   parent (optional) - path relative to root (when root given) or current workspace
   *   base (optional) - "workspace" (default) | "os" (root at /)
   */
  app.get("/api/workspace-allowed-children", (req, res) => {
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
        if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
          return res.json({ children: [] });
        }
        rootDir = candidate;
      } else {
        rootDir = getWorkspaceCwd();
      }
      if (process.env.NODE_ENV !== "production") {
        console.log("[workspace-allowed-children] rootDir=%s parent=%s", rootDir, req.query.parent ?? "(root)");
      }
      let parent = typeof req.query.parent === "string" ? req.query.parent.replace(/^\/+/, "").replace(/\\/g, "/") : "";
      if (parent.includes("..")) {
        return res.status(400).json({ error: "Invalid path" });
      }
      const dir = parent ? path.join(rootDir, parent) : rootDir;
      const resolvedDir = path.resolve(dir);
      const rootNorm = rootDir.replace(/\/$/, "") || rootDir;
      const ok = resolvedDir === rootNorm || resolvedDir.startsWith(rootNorm + path.sep);
      if (!ok) {
        return res.status(403).json({ error: "Path outside root" });
      }
      if (base !== "os" && !resolvedDir.startsWith(WORKSPACE_ALLOWED_ROOT) && resolvedDir !== WORKSPACE_ALLOWED_ROOT) {
        return res.status(403).json({ error: "Path outside allowed workspace" });
      }
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        return res.json({ children: [] });
      }
      const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
      const children = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: path.join(resolvedDir, e.name) }));
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
   * GET /api/git/commits
   * Returns recent git commits for the current workspace.
   */
  app.get("/api/git/commits", (req, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const commits = getGitCommits(cwd, limit);
      res.json({ commits });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to get git commits" });
    }
  });

  /**
   * GET /api/git/tree
   * Returns the file tree with their latest git commit.
   */
  app.get("/api/git/tree", (req, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const relPath = typeof req.query.path === "string" ? req.query.path : "";

      // Basic safeguard
      const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");

      const tree = getGitTree(cwd, normalized);
      res.json({ tree });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to get git tree" });
    }
  });

  /**
   * GET /api/git/status
   * Returns current git status (staged, unstaged, untracked).
   */
  app.get("/api/git/status", (req, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const status = getGitStatus(cwd);
      res.json({ status });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to get git status" });
    }
  });

  /**
   * GET /api/git/diff
   * Returns git diff for a specific file or all files locally.
   * Query params:
   *   - file: path to specific file
   *   - staged: 'true' to get cached diff
   */
  app.get("/api/git/diff", async (req, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const file = typeof req.query.file === "string" ? req.query.file : "";
      const isStaged = req.query.staged === "true";

      const { spawnSync } = await import("child_process");
      const args = ["diff", "--color=never"];
      if (isStaged) args.push("--cached");
      if (file) {
        args.push("--");
        args.push(file);
      }

      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      if (result.status !== 0 && result.status !== 1) {
        return res.status(500).json({ error: result.stderr || "Git diff failed" });
      }

      res.json({ diff: result.stdout });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to get git diff" });
    }
  });

  /**
   * POST /api/git/action
   * Performs a git write action: 'stage', 'commit', 'push'
   */
  app.post("/api/git/action", (req, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const action = req.body?.action;

      if (action === "stage") {
        const files = req.body?.files || [];
        const result = gitAdd(cwd, files);
        return res.json(result);
      }

      if (action === "commit") {
        const message = req.body?.message;
        const result = gitCommit(cwd, message);
        return res.json(result);
      }

      if (action === "push") {
        const result = gitPush(cwd);
        return res.json(result);
      }

      if (action === "init") {
        const result = gitInit(cwd);
        return res.json(result);
      }

      res.status(400).json({ error: "Invalid action" });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to execute git action" });
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

  /**
   * GET /api/processes
   * Returns processes listening on common dev ports (lsof + ps).
   */
  app.get("/api/processes", (_, res) => {
    try {
      const cwd = getWorkspaceCwd();
      const processes = listProcessesOnPorts(cwd);
      const withLogPaths = processes.map((p) => ({ ...p, logPaths: p.logPaths ?? [] }));
      res.json({ processes: withLogPaths });
    } catch (err) {
      console.error("[api/processes]", err?.message ?? err);
      // Return 200 with empty list so dashboard still loads (e.g. run-render terminals); client can show warning
      res.json({ processes: [], warning: err?.message ?? "Port scan failed" });
    }
  });

  /**
   * GET /api/processes/log
   * Return last N lines of a log file. Query: name (e.g. backend.log) or path (workspace-relative).
   * Uses tail -n to read; searches workspace and one level of subdirs when using name.
   */
  app.get("/api/processes/log", (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    const relPath = typeof req.query.path === "string" ? req.query.path.trim() : "";
    const lines = Math.min(Math.max(parseInt(req.query.lines, 10) || 200, 10), 500);
    try {
      const cwd = getWorkspaceCwd();
      let result;
      if (relPath) {
        const fullPath = path.join(cwd, path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, ""));
        result = getLogTail(fullPath, cwd, lines);
      } else if (name) {
        result = getLogTailByName(cwd, name, lines);
      } else {
        return res.status(400).json({ error: "Missing name or path" });
      }
      if (!result.ok) {
        return res.status(404).json({ error: result.error });
      }
      res.json({ content: result.content, path: result.path });
    } catch (err) {
      res.status(500).json({ error: err?.message ?? "Failed to read log" });
    }
  });

  /**
   * POST /api/processes/:pid/kill
   * Kill a process by PID.
   */
  app.post("/api/processes/:pid/kill", (req, res) => {
    const pid = req.params?.pid;
    if (!pid) {
      return res.status(400).json({ error: "Missing PID" });
    }
    const result = killProcess(pid);
    if (result.ok) {
      res.json({ ok: true });
    } else {
      res.status(400).json({ ok: false, error: result.error });
    }
  });

  // Docker status - always available for diagnostics (returns whether Docker API is enabled)
  app.get("/api/docker/status", (_, res) => {
    res.json({ enabled: !!ENABLE_DOCKER_MANAGER });
  });

  // Docker manager (optional, enabled via ENABLE_DOCKER_MANAGER=1)
  if (ENABLE_DOCKER_MANAGER) {
    const dockerMod = await import("../docker/index.js");
    const {
      listContainers,
      startContainer,
      stopContainer,
      restartContainer,
      removeContainer,
      getContainerLogs,
      listImages,
      removeImage,
      pruneImages,
      listVolumes,
      removeVolume,
      pruneVolumes,
    } = dockerMod;
    const publicDir = path.join(projectRoot, "public");

    app.get("/api/docker/diagnostic", async (_, res) => {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const diag = {
        ENABLE_DOCKER_MANAGER: !!ENABLE_DOCKER_MANAGER,
        DOCKER_SOCKET: process.env.DOCKER_SOCKET ?? null,
        platform: process.platform,
        home: os.default.homedir(),
        sockets: [],
        dockerClient: null,
        listContainers: null,
      };
      const candidates = process.env.DOCKER_SOCKET
        ? [path.default.resolve(process.env.DOCKER_SOCKET)]
        : ["/var/run/docker.sock", ...(process.platform === "darwin" ? [path.default.join(os.default.homedir(), ".docker", "run", "docker.sock")] : [])];
      for (const p of candidates) {
        let exists = false, isSocket = false, err = null;
        try {
          exists = fs.default.existsSync(p);
          if (exists) isSocket = fs.default.statSync(p).isSocket();
        } catch (e) {
          err = e?.message;
        }
        diag.sockets.push({ path: p, exists, isSocket, error: err });
      }
      try {
        const Docker = (await import("dockerode")).default;
        const socketPath = candidates.find((p) => {
          try {
            return fs.default.existsSync(p) && fs.default.statSync(p).isSocket();
          } catch {
            return false;
          }
        });
        if (socketPath) {
          const client = new Docker({ socketPath });
          diag.dockerClient = "created";
          const raw = await client.listContainers({ all: true });
          diag.listContainers = { ok: true, count: raw.length };
        } else {
          diag.dockerClient = "no_valid_socket";
        }
      } catch (e) {
        diag.dockerClient = diag.dockerClient ?? "error";
        diag.listContainersError = e?.message ?? String(e);
      }
      res.json(diag);
    });

    app.get("/docker", (_, res) => {
      res.sendFile(path.join(publicDir, "docker.html"));
    });
    app.get("/docker.js", (_, res) => {
      res.setHeader("Content-Type", "application/javascript");
      res.sendFile(path.join(publicDir, "docker.js"));
    });

    app.get("/api/docker/containers", async (req, res) => {
      try {
        const all = req.query.all === "true";
        const containers = await listContainers({ all });
        res.json({ containers });
      } catch (err) {
        const status = err?.message?.includes("not available") ? 503 : 500;
        res.status(status).json({ error: err?.message || "Failed to list containers" });
      }
    });

    app.post("/api/docker/containers/:id/start", async (req, res) => {
      try {
        await startContainer(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Failed to start container" });
      }
    });

    app.post("/api/docker/containers/:id/stop", async (req, res) => {
      try {
        await stopContainer(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Failed to stop container" });
      }
    });

    app.post("/api/docker/containers/:id/restart", async (req, res) => {
      try {
        await restartContainer(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Failed to restart container" });
      }
    });

    app.delete("/api/docker/containers/:id", async (req, res) => {
      try {
        const force = req.query.force === "true";
        await removeContainer(req.params.id, { force });
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Failed to remove container" });
      }
    });

    app.get("/api/docker/containers/:id/logs", async (req, res) => {
      try {
        const tail = req.query.tail ? parseInt(req.query.tail, 10) : 500;
        const opts = Number.isFinite(tail) && tail > 0 ? { tail } : {};
        const { logs } = await getContainerLogs(req.params.id, opts);
        res.json({ logs });
      } catch (err) {
        const status = err?.message?.includes("not available") ? 503 : 500;
        res.status(status).json({ error: err?.message || "Failed to get logs" });
      }
    });

    // Images (prune must be registered before :id)
    app.get("/api/docker/images", async (_, res) => {
      try {
        const images = await listImages();
        res.json({ images });
      } catch (err) {
        const status = err?.message?.includes("not available") ? 503 : 500;
        res.status(status).json({ error: err?.message || "Failed to list images" });
      }
    });

    app.post("/api/docker/images/prune", async (req, res) => {
      try {
        const filters = req.body?.filters || {};
        const result = await pruneImages({ filters });
        res.json(result);
      } catch (err) {
        const status = err?.message?.includes("not available") ? 503 : 500;
        res.status(status).json({ error: err?.message || "Failed to prune images" });
      }
    });

    app.delete("/api/docker/images/:id", async (req, res) => {
      try {
        const force = req.query.force === "true";
        await removeImage(req.params.id, { force });
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Failed to remove image" });
      }
    });

    // Volumes (prune must be registered before :name)
    app.get("/api/docker/volumes", async (_, res) => {
      try {
        const volumes = await listVolumes();
        res.json({ volumes });
      } catch (err) {
        const status = err?.message?.includes("not available") ? 503 : 500;
        res.status(status).json({ error: err?.message || "Failed to list volumes" });
      }
    });

    app.post("/api/docker/volumes/prune", async (_, res) => {
      try {
        const result = await pruneVolumes();
        res.json(result);
      } catch (err) {
        const status = err?.message?.includes("not available") ? 503 : 500;
        res.status(status).json({ error: err?.message || "Failed to prune volumes" });
      }
    });

    app.delete("/api/docker/volumes/:name", async (req, res) => {
      try {
        await removeVolume(req.params.name);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Failed to remove volume" });
      }
    });
  }

  // Catch-all for non-API paths so /abc.html and /subdir/index.html work
  // Must be registered after all /api/* routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    serveWorkspaceFile(req, res, next);
  });
}
