/**
 * Docker API routes (when ENABLE_DOCKER_MANAGER is set).
 */
import fs from "fs";
import path from "path";
import os from "os";
import { ENABLE_DOCKER_MANAGER, projectRoot } from "../config/index.js";

function dockerUnavailableStatus(err) {
  return err?.message?.includes("not available") ? 503 : 500;
}

export async function registerDockerRoutes(app) {
  app.get("/api/docker/status", (_, res) => {
    res.json({ enabled: !!ENABLE_DOCKER_MANAGER });
  });

  if (!ENABLE_DOCKER_MANAGER) return;

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
    const diag = await buildDiagnostic();
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
      res.status(dockerUnavailableStatus(err)).json({ error: err?.message || "Failed to list containers" });
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
      res.status(dockerUnavailableStatus(err)).json({ error: err?.message || "Failed to get logs" });
    }
  });

  app.get("/api/docker/images", async (_, res) => {
    try {
      const images = await listImages();
      res.json({ images });
    } catch (err) {
      res.status(dockerUnavailableStatus(err)).json({ error: err?.message || "Failed to list images" });
    }
  });

  app.post("/api/docker/images/prune", async (req, res) => {
    try {
      const filters = req.body?.filters || {};
      const result = await pruneImages({ filters });
      res.json(result);
    } catch (err) {
      res.status(dockerUnavailableStatus(err)).json({ error: err?.message || "Failed to prune images" });
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

  app.get("/api/docker/volumes", async (_, res) => {
    try {
      const volumes = await listVolumes();
      res.json({ volumes });
    } catch (err) {
      res.status(dockerUnavailableStatus(err)).json({ error: err?.message || "Failed to list volumes" });
    }
  });

  app.post("/api/docker/volumes/prune", async (_, res) => {
    try {
      const result = await pruneVolumes();
      res.json(result);
    } catch (err) {
      res.status(dockerUnavailableStatus(err)).json({ error: err?.message || "Failed to prune volumes" });
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

async function buildDiagnostic() {
  const candidates = process.env.DOCKER_SOCKET
    ? [path.resolve(process.env.DOCKER_SOCKET)]
    : ["/var/run/docker.sock", ...(process.platform === "darwin" ? [path.join(os.homedir(), ".docker", "run", "docker.sock")] : [])];

  const diag = {
    ENABLE_DOCKER_MANAGER: !!ENABLE_DOCKER_MANAGER,
    DOCKER_SOCKET: process.env.DOCKER_SOCKET ?? null,
    platform: process.platform,
    home: os.homedir(),
    sockets: [],
    dockerClient: null,
    listContainers: null,
  };

  for (const p of candidates) {
    let exists = false, isSocket = false, err = null;
    try {
      exists = fs.existsSync(p);
      if (exists) isSocket = fs.statSync(p).isSocket();
    } catch (e) {
      err = e?.message;
    }
    diag.sockets.push({ path: p, exists, isSocket, error: err });
  }

  try {
    const Docker = (await import("dockerode")).default;
    const socketPath = candidates.find((p) => {
      try {
        return fs.existsSync(p) && fs.statSync(p).isSocket();
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

  return diag;
}
