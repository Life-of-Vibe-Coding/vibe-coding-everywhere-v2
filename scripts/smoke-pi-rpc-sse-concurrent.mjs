#!/usr/bin/env node
/**
 * Smoke test: verify Pi RPC SSE can handle concurrent runs from different models.
 *
 * Runs 3 sessions in parallel (one per model) against the same server (port 3456).
 * The server uses a unique --session-dir per session to avoid Pi's workspace lock.
 * Each run uses task-heavy prompts (examine project, find bugs, summarize architecture)
 * so models perform tool calls and run longer, validating concurrency under realistic load.
 *
 * Uses REST + SSE (POST to create session, GET to stream). Verifies:
 * - Each session receives its own output (no cross-talk)
 * - Each session completes with exit event
 * - Each session output contains its unique token
 *
 * Usage:
 *   WORKSPACE_CWD=/path/to/workspace node server.js &
 *   node scripts/smoke-pi-rpc-sse-concurrent.mjs
 *
 *   SERVER_URL=http://localhost:3456 node scripts/smoke-pi-rpc-sse-concurrent.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { EventSource } = require("eventsource");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3456";
const PROMPT_TIMEOUT_MS = parseInt(process.env.PROMPT_TIMEOUT_MS || "360000", 10); // 6 min per session (task-heavy prompts)
const DEBUG_SMOKE = process.env.DEBUG_SMOKE === "1" || process.env.DEBUG_SMOKE === "true";

/** Three concurrent runs with distinct models and tasks. Prompts trigger tool use (ls, read, etc.)
 * so the test runs longer and validates concurrency under realistic workload. */
const RUNS = [
  {
    provider: "codex",
    model: "gpt-5.2-codex",
    label: "codex5.2",
    prompt: "Examine the current project root, find possible bugs. Be thorough: list the directory structure, inspect key files, and report any issues you notice. In your final reply, include this exact token: {TOKEN}. Be concise but substantive.",
  },
  {
    provider: "codex",
    model: "gpt-5.1-codex-mini",
    label: "codex5.1",
    prompt: "Examine the current project root and summarize the architecture. Look at the main directories, configuration files, and how components connect. In your final reply, include this exact token: {TOKEN}. Be concise but substantive.",
  },
  {
    provider: "claude",
    model: "sonnet4.5",
    label: "sonnet4.5",
    prompt: "Examine the current project root and explain what the backend does. Inspect the server code, routes, and any API definitions. In your final reply, include this exact token: {TOKEN}. Be concise but substantive.",
  },
];

/**
 * Extract text from Pi output events (message_update with delta, message with content, etc.)
 */
function extractText(parsed) {
  if (!parsed || typeof parsed !== "object") return "";
  if (parsed.assistantMessageEvent?.delta) return parsed.assistantMessageEvent.delta;
  if (parsed.assistantMessageEvent?.content) return String(parsed.assistantMessageEvent.content ?? "");
  if (parsed.result?.content) {
    const arr = Array.isArray(parsed.result.content) ? parsed.result.content : [];
    return arr.map((c) => c?.text ?? "").filter(Boolean).join("");
  }
  // Pi native "message" type with message.content array (text, thinking, toolCall)
  if (parsed.type === "message" && parsed.message?.content) {
    const arr = Array.isArray(parsed.message.content) ? parsed.message.content : [];
    return arr
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("");
  }
  return "";
}

/**
 * Submit prompt via POST /api/sessions (creates session, starts Pi RPC).
 */
async function submitPrompt(sessionId, provider, model, prompt) {
  const res = await fetch(`${SERVER_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, provider, model, prompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/sessions failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Submit failed");
  return json.sessionId;
}

/**
 * Run one concurrent task: submit prompt, connect SSE client, collect output until exit.
 */
async function runOne(cfg, index) {
  const label = cfg.label || `${cfg.provider}/${cfg.model}`;
  const sessionId = `smoke-concurrent-${index}-${crypto.randomUUID()}`;
  const token = `SMOKE_CONCURRENT_${index}_${Date.now()}`;
  const prompt = cfg.prompt.replace("{TOKEN}", token);

  try {
    await submitPrompt(sessionId, cfg.provider, cfg.model, prompt);
  } catch (err) {
    return { label, index, submitError: err.message, fullOutput: "", exitCode: null };
  }

  const result = await runSseClient(sessionId, token);
  return {
    label,
    index,
    submitError: null,
    fullOutput: result.fullOutput,
    exitCode: result.exitCode,
    error: result.error,
    token,
  };
}

/**
 * Connect to session stream via SSE and collect output until end event.
 */
function runSseClient(sessionId, token) {
  return new Promise((resolve) => {
    let fullOutput = "";
    let exitCode = null;
    let outputBuffer = "";
    let resolved = false;

    // Do NOT use activeOnly=1: it causes immediate end when processRunning is false
    // (agent_start arrives after prompt; connecting right after POST races with it)
    const url = `${SERVER_URL}/api/sessions/${encodeURIComponent(sessionId)}/stream`;
    const es = new EventSource(url);

    const finish = (err) => {
      if (resolved) return;
      resolved = true;
      try {
        es.close();
      } catch (_) {}
      resolve({
        token,
        fullOutput,
        exitCode,
        error: err,
      });
    };

    const timeout = setTimeout(() => {
      finish(`Timeout after ${PROMPT_TIMEOUT_MS / 1000}s`);
    }, PROMPT_TIMEOUT_MS);

    es.onmessage = (ev) => {
      const str = typeof ev.data === "string" ? ev.data : String(ev.data ?? "");
      outputBuffer += str + "\n";
      const lines = outputBuffer.split("\n");
      outputBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const text = extractText(parsed);
          if (text) fullOutput += text;
        } catch {
          fullOutput += trimmed + "\n";
        }
      }
    };

    es.addEventListener("end", (ev) => {
      try {
        const data = ev.data ? JSON.parse(ev.data) : {};
        exitCode = data.exitCode ?? 0;
      } catch (_) {}
      clearTimeout(timeout);
      finish();
    });

    es.onerror = () => {
      if (!resolved) {
        clearTimeout(timeout);
        finish("SSE connection error");
      }
    };
  });
}

async function main() {
  console.error("[smoke] Pi RPC SSE concurrent runs smoke test");
  console.error("[smoke] SERVER_URL:", SERVER_URL);
  console.error("[smoke] Running 3 models in parallel (codex5.2, codex5.1, sonnet4.5)\n");

  const start = Date.now();

  // Run all 3 sessions in parallel (server uses unique --session-dir per session to avoid Pi lock)
  const results = await Promise.all(RUNS.map((cfg, i) => runOne(cfg, i)));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const tokens = results.map((r) => r.token);
  let passed = true;

  for (const r of results) {
    const hasOwnToken = r.fullOutput.includes(r.token);
    const hasOthersToken = tokens.some((t) => t !== r.token && r.fullOutput.includes(t));
    const gotExit = r.exitCode !== null;
    const noError = !r.error;
    const noSubmitError = !r.submitError;

    const ok = hasOwnToken && !hasOthersToken && gotExit && noError && noSubmitError;
    if (!ok) passed = false;

    const status = ok ? "PASS" : "FAIL";
    console.error(`[smoke] ${r.label}: ${status}`);
    if (r.submitError) console.error(`         Submit error: ${r.submitError}`);
    if (r.error) console.error(`         Error: ${r.error}`);
    if (!hasOwnToken) console.error(`         Missing own token in output`);
    if (hasOthersToken) console.error(`         CROSS-TALK: received another session's token!`);
    if (!gotExit) console.error(`         Did not receive exit event`);
    if (ok) {
      const preview = r.fullOutput.slice(0, 80).replace(/\n/g, " ");
      console.error(`         Output preview: "${preview}..."`);
    }
  }

  console.error("");
  console.error(`[smoke] Elapsed: ${elapsed}s`);
  if (passed) {
    console.error("[smoke] All concurrent runs passed. Pi RPC SSE handles concurrency correctly.");
    process.exit(0);
  } else {
    console.error("[smoke] One or more runs failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[smoke] Fatal:", err);
  process.exit(1);
});
