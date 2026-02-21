/**
 * Skills discovery and management routes.
 */
import { SKILLS_DIR, projectRoot, getWorkspaceCwd } from "../config/index.js";
import {
  discoverSkills,
  getSkillContent,
  getSkillChildren,
  getEnabledIds,
  setEnabledIds,
  resolveAgentDir,
} from "../skills/index.js";

export function registerSkillsRoutes(app) {
  app.get("/api/skills", (_, res) => {
    try {
      const data = discoverSkills(SKILLS_DIR);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to list skills" });
    }
  });

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
}
