/**
 * Process management for AI provider via Pi RPC (pi-mono).
 * Supports Claude, Gemini, and Codex through the unified Pi coding agent.
 */
import {
  getWorkspaceCwd,
  getLlmCliIoTurnPaths,
  projectRoot,
  SKILLS_DIR,
  DEFAULT_PERMISSION_MODE,
  DEFAULT_PROVIDER,
} from "../config/index.js";

import { createPiRpcSession } from "./piRpcSession.js";
import { getSkillsRoster, loadEnabledSkillsContent, resolveAgentDir } from "../skills/index.js";

export const globalSpawnChildren = new Set();

export function shutdown(signal) {
  for (const c of globalSpawnChildren) {
    try {
      if (process.platform !== "win32" && c.pid) {
        try {
          process.kill(-c.pid, "SIGTERM");
        } catch (_) {}
      }
      c.kill();
    } catch (_) {}
  }
  globalSpawnChildren.clear();
  process.exit(0);
}

function emitError(socket, message) {
  socket.emit("output", `\r\n\x1b[31m[Error] ${message}\x1b[0m\r\n`);
}

/** Format current time as yyyy-MM-dd_HH-mm-ss (24-hour) for log directory names. */
function formatSessionLogTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Creates an AI process manager for a socket connection.
 * Uses Pi RPC for all providers (claude, gemini, codex).
 */
export function createProcessManager(socket, { hasCompletedFirstRunRef, session_management }) {
  let turnCounter = 0;
  const piRpcSession = createPiRpcSession({
    socket,
    hasCompletedFirstRunRef,
    sessionManagement: session_management,
    globalSpawnChildren,
    getWorkspaceCwd,
    projectRoot,
    getLlmCliIoTurnPaths,
  });

  function processRunning() {
    return piRpcSession.isTurnRunning();
  }

  function handleSubmitPrompt(payload) {
    console.log("[submit-prompt] full input:", JSON.stringify(payload, null, 2));
    const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";

    if (!prompt) {
      emitError(socket, "Prompt cannot be empty.");
      return;
    }

    const provider =
      payload?.provider === "pi"
        ? "pi"
        : payload?.provider === "codex"
          ? "codex"
          : payload?.provider === "gemini"
            ? "gemini"
            : payload?.provider === "claude"
              ? "claude"
              : DEFAULT_PROVIDER;

    console.log("[submit-prompt] chat input (user prompt):", prompt, "provider:", provider);

    const defaultModel =
      provider === "claude" ? "sonnet4.5" : provider === "pi" || provider === "codex" ? "gpt-5.1-codex-mini" : "gemini-2.5-flash";
    const model =
      typeof payload?.model === "string" && payload.model.trim()
        ? payload.model.trim()
        : defaultModel;

    if (
      session_management &&
      (session_management.provider !== provider || session_management.model !== model)
    ) {
      session_management.session_id = null;
      session_management.session_log_timestamp = null;
      session_management.provider = provider;
      session_management.model = model;
      hasCompletedFirstRunRef.value = false;
    }

    turnCounter += 1;
    if (session_management && !session_management.session_log_timestamp) {
      session_management.session_log_timestamp = formatSessionLogTimestamp();
    }
    const conversationSessionId = socket.id ?? "unknown";

    const options = {
      model,
      clientProvider: provider,
      permissionMode: DEFAULT_PERMISSION_MODE || null,
      allowedTools: [],
      useContinue: hasCompletedFirstRunRef.value,
      hasCompletedFirstRunRef,
      sessionLogTimestamp: session_management?.session_log_timestamp ?? undefined,
      conversationSessionId,
      turnId: turnCounter,
    };

    if (session_management) {
      session_management.provider = provider;
      session_management.model = model;
    }

    const cwd = getWorkspaceCwd();
    const agentDir = resolveAgentDir(cwd, projectRoot);
    const roster = getSkillsRoster(SKILLS_DIR, agentDir);
    const enabledContent = loadEnabledSkillsContent(SKILLS_DIR, agentDir);
    const skillsContext = [roster, enabledContent].filter(Boolean).join("");
    const finalPrompt = skillsContext ? skillsContext + prompt : prompt;

    piRpcSession.startTurn({ prompt: finalPrompt, options }).catch((err) => {
      emitError(socket, err?.message || "Failed to start Pi RPC.");
      socket.emit("exit", { exitCode: 1 });
    });
  }

  function handleInput(data) {
    console.log(
      "[input] chat input (user reply):",
      typeof data === "string" ? data.replace(/\r$/, "") : JSON.stringify(data)
    );
    piRpcSession.handleInput(data);
  }

  function handleResize() {
    // Pi RPC does not support terminal resize; no-op for API compatibility
  }

  function handleTerminate(payload) {
    const resetSession = !!payload?.resetSession;
    if (resetSession && session_management) {
      hasCompletedFirstRunRef.value = false;
      session_management.session_id = null;
      session_management.session_log_timestamp = null;
    }
    piRpcSession.close();
    socket.emit("exit", { exitCode: 0 });
  }

  function handleDebug(payload) {
    console.log("[claude-debug]", JSON.stringify(payload, null, 2));
  }

  function cleanup() {
    piRpcSession.close();
  }

  return {
    processRunning,
    claudeProcessRunning: processRunning,
    handleSubmitPrompt,
    handleInput,
    handleResize,
    handleTerminate,
    handleDebug,
    cleanup,
  };
}
