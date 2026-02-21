/**
 * Socket.IO handlers for the server.
 * 
 * Manages real-time communication between clients and the server,
 * handling both Claude PTY sessions and terminal command execution.
 */
import { spawn } from "child_process";
import treeKill from "tree-kill";
import { getWorkspaceCwd } from "../config/index.js";
import { killProcessOnPort } from "../utils/index.js";
import { createProcessManager, globalSpawnChildren } from "../process/index.js";

/**
 * Creates a manager for run-render terminals.
 * Handles lifecycle of command execution terminals separate from Claude sessions.
 * 
 * @param {import('socket.io').Socket} socket - The Socket.IO connection
 * @returns {Object} Terminal manager with handlers for create, write, command, terminate
 */
function createRunRenderManager(socket) {
  // Map of terminalId -> child process
  const runRenderTerminals = new Map();
  // Map of terminalId -> port number (for killing processes on specific ports)
  const runRenderPortByTerminalId = new Map();

  /**
   * Generate a unique terminal ID using timestamp and random string.
   * Format: t-<timestamp>-<random>
   * @returns {string} Unique terminal identifier
   */
  function nextTerminalId() {
    return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Kill a terminal child process and clean up resources.
   * Also kills any process listening on the associated port.
   * 
   * @param {import('child_process').ChildProcess} child - The child process to kill
   * @param {string} terminalId - The terminal identifier
   */
  function killRunRenderChild(child, terminalId) {
    const id = typeof terminalId === "string" ? terminalId : null;
    
    // Kill any process on the associated port (e.g., if running a web server)
    const port = id ? runRenderPortByTerminalId.get(id) : null;
    if (port) {
      killProcessOnPort(port);
      runRenderPortByTerminalId.delete(id);
    }
    
    // Remove from tracking maps
    runRenderTerminals.delete(id);
    globalSpawnChildren.delete(child);
    
    // Kill the process tree
    const pid = child.pid;
    if (pid) {
      try {
        // Use tree-kill to ensure all child processes are terminated
        treeKill(pid, "SIGKILL", (err) => {
          if (err) {
            // Fallback to direct kill if tree-kill fails
            try {
              child.kill("SIGKILL");
            } catch (_) {}
          }
        });
      } catch (_) {
        try {
          child.kill("SIGKILL");
        } catch (_) {}
      }
    } else {
      try {
        child.kill("SIGKILL");
      } catch (_) {}
    }
  }

  /**
   * Handle 'run-render-new-terminal' event.
   * Creates a new interactive shell terminal.
   * Uses cmd.exe on Windows, bash on Unix systems.
   */
  function handleNewTerminal() {
    const terminalId = nextTerminalId();
    try {
      // Spawn appropriate shell for the platform
      const isWin = process.platform === "win32";
      const cwd = getWorkspaceCwd();
      const child = isWin
        ? spawn("cmd", ["/K"], {
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
          })
        : spawn("bash", ["-i"], {
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, TERM: "xterm-256color" },
            detached: true,
          });
      
      // Track the child process
      runRenderTerminals.set(terminalId, child);
      globalSpawnChildren.add(child);
      
      // Notify client first so terminal exists before any stdout/stderr (avoids dropped chunks on client)
      socket.emit("run-render-started", { terminalId, pid: child.pid ?? null });
      
      // Set up output encoding
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      
      // Forward stdout to client
      child.stdout?.on("data", (chunk) => {
        socket.emit("run-render-stdout", { terminalId, chunk: String(chunk) });
      });
      
      // Forward stderr to client
      child.stderr?.on("data", (chunk) => {
        socket.emit("run-render-stderr", { terminalId, chunk: String(chunk) });
      });
      
      // Handle process exit
      child.on("exit", (code, signal) => {
        globalSpawnChildren.delete(child);
        runRenderTerminals.delete(terminalId);
        socket.emit("run-render-exit", { terminalId, code, signal: signal || null });
      });
      
      // Handle process errors
      child.on("error", (err) => {
        globalSpawnChildren.delete(child);
        runRenderTerminals.delete(terminalId);
        socket.emit("run-render-stderr", { terminalId, chunk: `[error] ${err.message}\n` });
        socket.emit("run-render-exit", { terminalId, code: 1, signal: null });
      });
    } catch (err) {
      socket.emit("run-render-result", { ok: false, error: err.message || "Failed to create terminal." });
    }
  }

  /**
   * Handle 'run-render-write' event.
   * Writes data to a terminal's stdin.
   * 
   * @param {Object} params
   * @param {string} params.terminalId - Target terminal ID
   * @param {string} params.data - Data to write
   */
  function handleWrite({ terminalId, data }) {
    const id = typeof terminalId === "string" ? terminalId : null;
    const str = typeof data === "string" ? data : "";
    if (!id || !str) return;
    
    const child = runRenderTerminals.get(id);
    if (child?.stdin?.writable) {
      child.stdin.write(str);
    }
  }

  /**
   * Handle 'run-render-command' event.
   * Executes a shell command in a new terminal.
   * If a URL is provided with a port, any process on that port is killed first.
   * 
   * @param {Object} params
   * @param {string} params.command - Shell command to execute
   * @param {string} [params.url] - Optional URL (used to extract port for cleanup)
   */
  function handleCommand({ command, url }) {
    const cmd = typeof command === "string" ? command.trim() : "";
    if (!cmd) {
      socket.emit("run-render-result", { ok: false, error: "No command provided." });
      return;
    }
    
    // Extract port from URL if provided
    const urlStr = typeof url === "string" ? url.trim() : "";
    let port = null;
    if (urlStr) {
      try {
        const u = new URL(urlStr);
        if (u.port) port = u.port;
      } catch (_) {}
    }
    
    // Kill any existing process on this port
    if (port) killProcessOnPort(port);
    
    // Create new terminal for this command
    const terminalId = nextTerminalId();
    if (port) runRenderPortByTerminalId.set(terminalId, port);
    
    try {
      const cwd = getWorkspaceCwd();
      const isWin = process.platform === "win32";
      // Use login shell on Unix so PATH (e.g. python, node) matches the user's environment
      const child = isWin
        ? spawn(cmd, {
            shell: true,
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, PYTHONUNBUFFERED: "1" },
          })
        : spawn(process.env.SHELL || "/bin/zsh", ["-l", "-c", cmd], {
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, TERM: "xterm-256color", PYTHONUNBUFFERED: "1" },
            detached: true,
          });
      
      // Track the process
      runRenderTerminals.set(terminalId, child);
      globalSpawnChildren.add(child);
      
      // Handle stdin errors silently
      if (child.stdin) {
        child.stdin.on("error", () => {});
      }
      
      // Notify client first so terminal exists before any stdout/stderr (avoids dropped chunks on client)
      socket.emit("run-render-started", { terminalId, pid: child.pid ?? null, command: cmd });
      socket.emit("run-render-result", { ok: true, url: url || "", terminalId });

      // Set up output encoding
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      
      // Forward stdout to client
      child.stdout?.on("data", (chunk) => {
        socket.emit("run-render-stdout", { terminalId, chunk: String(chunk) });
      });
      
      // Forward stderr to client
      child.stderr?.on("data", (chunk) => {
        socket.emit("run-render-stderr", { terminalId, chunk: String(chunk) });
      });
      
      // Handle process exit
      child.on("exit", (code, signal) => {
        globalSpawnChildren.delete(child);
        runRenderTerminals.delete(terminalId);
        runRenderPortByTerminalId.delete(terminalId);
        socket.emit("run-render-exit", { terminalId, code, signal: signal || null });
      });
      
      // Handle process errors
      child.on("error", (err) => {
        globalSpawnChildren.delete(child);
        runRenderTerminals.delete(terminalId);
        runRenderPortByTerminalId.delete(terminalId);
        socket.emit("run-render-stderr", { terminalId, chunk: `[error] ${err.message}\n` });
        socket.emit("run-render-result", { ok: false, error: err.message || "Failed to run command.", terminalId });
      });
    } catch (err) {
      socket.emit("run-render-result", { ok: false, error: err.message || "Failed to run command." });
    }
  }

  /**
   * Handle 'run-render-terminate' event.
   * Gracefully terminates a terminal process.
   * First sends Ctrl+C (\x03) and Ctrl+D (\x04), then force kills after delay.
   * 
   * @param {Object} params
   * @param {string} params.terminalId - Terminal to terminate
   */
  function handleTerminate({ terminalId }) {
    const id = typeof terminalId === "string" ? terminalId : null;
    const child = id ? runRenderTerminals.get(id) : null;
    
    if (id && child) {
      // Try graceful termination first
      if (child.stdin?.writable) {
        try {
          child.stdin.write("\x03"); // Ctrl+C
          child.stdin.write("\x04"); // Ctrl+D (EOF)
        } catch (_) {}
      }
      
      // Force kill after 3 seconds if still running
      setTimeout(() => {
        const currentChild = runRenderTerminals.get(id);
        if (!currentChild) return;
        killRunRenderChild(currentChild, id);
      }, 3000);
    }
  }

  /**
   * Clean up all terminals when socket disconnects.
   * Kills all child processes and clears tracking maps.
   */
  function cleanup() {
    for (const [tid, child] of runRenderTerminals) {
      killRunRenderChild(child, tid);
    }
    runRenderTerminals.clear();
    runRenderPortByTerminalId.clear();
  }

  // Return handlers for registration
  return {
    handleNewTerminal,
    handleWrite,
    handleCommand,
    handleTerminate,
    cleanup,
  };
}

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

    // Create managers for AI provider (Claude/Gemini) and terminal processes
    const processManager = createProcessManager(socket, {
      hasCompletedFirstRunRef,
      session_management,
    });
    const runRenderManager = createRunRenderManager(socket);

    // AI PTY events (submit-prompt payload may include provider: "claude" | "gemini")
    socket.on("submit-prompt", processManager.handleSubmitPrompt);
    socket.on("input", processManager.handleInput);
    socket.on("resize", processManager.handleResize);
    socket.on("claude-terminate", processManager.handleTerminate);
    socket.on("claude-debug", processManager.handleDebug);

    // Terminal/run-render events
    socket.on("run-render-new-terminal", runRenderManager.handleNewTerminal);
    socket.on("run-render-write", runRenderManager.handleWrite);
    socket.on("run-render-command", runRenderManager.handleCommand);
    socket.on("run-render-terminate", runRenderManager.handleTerminate);

    // Clean up all processes when client disconnects
    socket.on("disconnect", () => {
      processManager.cleanup();
      runRenderManager.cleanup();
    });
  });
}
