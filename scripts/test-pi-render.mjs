#!/usr/bin/env node
/**
 * Test Pi with "Render shophub" prompt.
 * Connects to the server, submits prompt, and monitors output for phase progression and hang detection.
 *
 * Usage:
 *   WORKSPACE_CWD=/path/to/workspace_for_testing node server.js &
 *   node scripts/test-pi-render.mjs
 *
 * Or: WORKSPACE_CWD=/path/to/workspace_for_testing node scripts/test-pi-render.mjs
 *     (assumes server is already running on port 3456)
 */
import { io } from "socket.io-client";

const WORKSPACE = "/Users/yifanxu/machine_learning/LoVC/vibe-coding-everywhere_v2/workspace_for_testing";
const PROMPT = "Render shophub";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3456";
const HANG_TIMEOUT_MS = 300_000; // 5 minutes - if no progress, consider hung

const phases = {
  phase0: false,
  phase1: false,
  phase2: false,
  phase3: false,
  phase4: false,
};
let lastBashToolId = null;
let lastBashStartAt = null;
let lastActivityAt = Date.now();
let agentEnded = false;
let hangDetectedAt = null;

function extractText(parsed) {
  if (!parsed || typeof parsed !== "object") return "";
  if (parsed.assistantMessageEvent?.delta) return parsed.assistantMessageEvent.delta;
  if (parsed.assistantMessageEvent?.content) return String(parsed.assistantMessageEvent.content ?? "");
  if (parsed.result?.content) {
    const arr = Array.isArray(parsed.result.content) ? parsed.result.content : [];
    return arr.map((c) => c?.text ?? "").filter(Boolean).join("");
  }
  return "";
}

function trackPhase(text) {
  const lower = text.toLowerCase();
  if (lower.includes("phase 0") || lower.includes("cleaning ports")) phases.phase0 = true;
  if (lower.includes("phase 1") || lower.includes("installing")) phases.phase1 = true;
  if (lower.includes("phase 2") || lower.includes("starting services")) phases.phase2 = true;
  if (lower.includes("phase 3") || lower.includes("monitoring")) phases.phase3 = true;
  if (lower.includes("phase 4") || lower.includes("verification")) phases.phase4 = true;
}

function handleParsedLine(parsed) {
  lastActivityAt = Date.now();
  const text = extractText(parsed);
  if (text) {
    trackPhase(text);
    process.stdout.write(text);
  }
  // Track tool_execution for bash
  if (parsed?.type === "tool_execution_start" && parsed?.toolName === "bash") {
    lastBashToolId = parsed.toolCallId;
    lastBashStartAt = Date.now();
    console.error(`\n[TEST] Bash tool started: ${parsed.toolCallId?.slice?.(0, 20)}...`);
  }
  if (parsed?.type === "tool_execution_end" && parsed?.toolCallId === lastBashToolId) {
    const duration = lastBashStartAt ? Date.now() - lastBashStartAt : 0;
    console.error(`\n[TEST] Bash tool completed in ${duration}ms`);
    lastBashToolId = null;
  }
  if (parsed?.type === "agent_end") {
    agentEnded = true;
  }
}

let outputBuffer = "";
function onOutput(data) {
  const str = typeof data === "string" ? data : String(data ?? "");
  outputBuffer += str;
  const lines = outputBuffer.split("\n");
  outputBuffer = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      handleParsedLine(parsed);
    } catch {
      trackPhase(trimmed);
      process.stdout.write(trimmed + "\n");
    }
  }
}

async function main() {
  console.error("[TEST] Connecting to", SERVER_URL);
  console.error("[TEST] Workspace:", WORKSPACE);
  console.error("[TEST] Prompt:", PROMPT);
  console.error("[TEST] Hang timeout:", HANG_TIMEOUT_MS / 1000, "seconds");
  console.error("");

  const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    console.error("[TEST] Connected. Setting workspace and submitting prompt...");
    fetch(`${SERVER_URL}/api/workspace-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: WORKSPACE }),
    }).then((r) => {
      if (!r.ok) console.error("[TEST] Failed to set workspace:", r.status);
      socket.emit("submit-prompt", {
        prompt: PROMPT,
        provider: "claude",
      });
    });
  });

  socket.on("output", onOutput);
  socket.on("exit", (data) => {
    console.error("\n[TEST] Session exit:", data);
    if (agentEnded) {
      console.error("[TEST] Phases reached:", JSON.stringify(phases, null, 2));
      if (lastBashToolId) {
        console.error("[TEST] WARN: Last bash tool may not have completed:", lastBashToolId);
      }
    }
  });
  socket.on("connect_error", (err) => {
    console.error("[TEST] Connection error:", err.message);
    process.exit(1);
  });

  // Hang detection loop
  const checkInterval = setInterval(() => {
    if (agentEnded) {
      clearInterval(checkInterval);
      return;
    }
    const idle = Date.now() - lastActivityAt;
    if (idle > 30_000) {
      // 30s no activity after Phase 2 started
      if (phases.phase2 && lastBashToolId) {
        hangDetectedAt = hangDetectedAt || Date.now();
        const hangSec = Math.round((Date.now() - hangDetectedAt) / 1000);
        if (hangSec >= 60) {
          console.error("\n[TEST] *** HANG DETECTED at Phase 2 (or later) ***");
          console.error("[TEST] Bash tool did not complete within 60s of last activity.");
          console.error("[TEST] Last bash toolId:", lastBashToolId);
          clearInterval(checkInterval);
          process.exit(2);
        }
      }
    } else {
      hangDetectedAt = null;
    }
  }, 5000);

  // Overall timeout
  setTimeout(() => {
    if (agentEnded) return;
    clearInterval(checkInterval);
    console.error("\n[TEST] *** TIMEOUT after", HANG_TIMEOUT_MS / 1000, "seconds ***");
    console.error("[TEST] Phases reached:", JSON.stringify(phases, null, 2));
    if (lastBashToolId) {
      console.error("[TEST] Last bash tool still running (no tool_execution_end):", lastBashToolId);
    }
    process.exit(3);
  }, HANG_TIMEOUT_MS);
}

main().catch((err) => {
  console.error("[TEST] Error:", err);
  process.exit(1);
});
