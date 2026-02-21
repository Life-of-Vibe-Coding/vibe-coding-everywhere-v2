/**
 * Config and workspace path routes.
 */
import { SIDEBAR_REFRESH_INTERVAL_MS, getWorkspaceCwd, setWorkspaceCwd, WORKSPACE_ALLOWED_ROOT } from "../config/index.js";

export function registerConfigRoutes(app) {
  app.get("/api/config", (_, res) => {
    res.json({
      sidebarRefreshIntervalMs: SIDEBAR_REFRESH_INTERVAL_MS,
    });
  });

  app.get("/api/workspace-path", (_, res) => {
    const cwd = getWorkspaceCwd();
    if (process.env.NODE_ENV !== "production") {
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

  app.post("/api/workspace-path", (req, res) => {
    const raw = req.body?.path ?? req.query?.path;
    const result = setWorkspaceCwd(raw);
    if (result.ok) {
      res.json({ path: getWorkspaceCwd() });
    } else {
      res.status(400).json({ error: result.error });
    }
  });
}
