/**
 * Main server entry point.
 * Refactored into modular architecture for better maintainability.
 */
import "dotenv/config";
import express from "express";
import { createServer } from "http";

import { PORT, ENABLE_DOCKER_MANAGER } from "./server/config/index.js";
import { getPreviewHost, getActiveOverlay } from "./server/utils/index.js";
import { shutdown } from "./server/process/index.js";
import { setupRoutes } from "./server/routes/index.js";

const app = express();
app.use(express.json());
const httpServer = createServer(app);

// Setup Express routes
await setupRoutes(app);

// Handle process signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

httpServer.listen(PORT, "0.0.0.0", () => {
  const overlay = getActiveOverlay();
  const previewHost = getPreviewHost();
  const hostForLog = process.env.HOST || "localhost";
  const baseUrl = `http://${hostForLog}:${PORT}`;

  console.log(`Terminal server at http://localhost:${PORT}`);
  console.log(`Health check page: ${baseUrl}/health`);
  console.log(`Health check alias: ${baseUrl}/health-check`);
  console.log(`[Docker] ENABLE_DOCKER_MANAGER: ${ENABLE_DOCKER_MANAGER} (env raw: "${process.env.ENABLE_DOCKER_MANAGER ?? "(unset)"}")`);
  console.log(`Overlay network: ${overlay}`);
  if (overlay === "tunnel") {
    console.log(`Tunnel preview host: ${previewHost}`);
    console.log(`Tunnel mode: traffic via dev proxy (e.g. Cloudflare Tunnel)`);
  } else {
    console.log(`Preview host: ${previewHost}`);
    console.log(`Listening on 0.0.0.0`);
  }
  console.log(`Working directory: ${process.env.WORKSPACE_CWD || "(using default)"}`);
});
