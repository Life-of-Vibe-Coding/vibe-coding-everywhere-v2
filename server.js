/**
 * Main server entry point.
 * Refactored into modular architecture for better maintainability.
 */
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { PORT, ensureLlmCliIoRunDir } from "./server/config/index.js";
import { shutdown } from "./server/process/index.js";
import { setupRoutes } from "./server/routes/index.js";
import { setupSocketHandlers } from "./server/socket/index.js";

const app = express();
app.use(express.json());
const httpServer = createServer(app);

// Setup Express routes
setupRoutes(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

setupSocketHandlers(io);

// Handle process signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

ensureLlmCliIoRunDir();

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Terminal server at http://localhost:${PORT}`);
  console.log(`Listening on 0.0.0.0 for Tailscale access`);
  console.log(`Working directory: ${process.env.WORKSPACE_CWD || "(using default)"}`);
});
