/**
 * Socket.IO handlers for the server.
 *
 * Manages real-time communication between clients and the server,
 * handling Claude PTY sessions.
 */
import { createProcessManager } from "../process/index.js";

/**
 * Setup Socket.IO event handlers for all client connections.
 * 
 * @param {import('socket.io').Server} io - The Socket.IO server instance
 */
export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Track if first run has completed (used for --resume on Gemini / --resume <id> on Claude)
    const hasCompletedFirstRunRef = { value: false };
    // Session state: no session_id until first conversation is established; swap provider/model = new session
    const session_management = {
      session_id: null,
      session_log_timestamp: null,
      provider: null,
      model: null,
    };

    const processManager = createProcessManager(socket, {
      hasCompletedFirstRunRef,
      session_management,
    });

    socket.on("submit-prompt", processManager.handleSubmitPrompt);
    socket.on("input", processManager.handleInput);
    socket.on("resize", processManager.handleResize);
    socket.on("claude-terminate", processManager.handleTerminate);
    socket.on("claude-debug", processManager.handleDebug);

    socket.on("disconnect", () => {
      processManager.cleanup();
    });
  });
}
