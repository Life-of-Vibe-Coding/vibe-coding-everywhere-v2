#!/usr/bin/env node
/**
 * Smoke test: verify Pi RPC can handle multiple SSE clients on the same session.
 *
 * Uses REST + SSE (no WebSocket). Single session per provider, single Pi RPC process.
 * Connects N SSE clients to the same session stream, submits one prompt, and verifies:
 * - All clients receive the streamed output (no cross-talk; same session)
 * - Each client gets the unique token in the output
 * - Stream ends with exit event
 *
 * Providers run concurrently:
 * 1. Codex 5.1: examine the codebase of project root, report possible bugs
 * 2. Codex 5.2: examine the codebase of project root, think about its design
 * 3. Claude Sonnet 4.5: examine the codebase of project root, create a skill for debug backend
 *
 * Usage:
 *   npm install eventsource   # required for Node.js
 *   WORKSPACE_CWD=/path/to/workspace node server.js &
 *   node scripts/smoke-pi-rpc-sse-multi-client.mjs
 *
 *   SERVER_URL=http://localhost:3456 node scripts/smoke-pi-rpc-sse-multi-client.mjs
 *   NUM_SSE_CLIENTS=5 node scripts/smoke-pi-rpc-sse-multi-client.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { EventSource } = require("eventsource");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3456";
const NUM_SSE_CLIENTS = parseInt(process.env.NUM_SSE_CLIENTS || "3", 10) || 3;
const PROMPT_TIMEOUT_MS = 120_000; // 2 min per provider (LLM latency)

/** Provider configs: run concurrently */
const PROVIDERS = [
  { provider: "codex", model: "gpt-5.1-codex-mini", label: "codex5.1", prompt: "Examine the codebase of project root, and report possible bugs. In your reply, include this exact token: {TOKEN}. Be brief." },
  { provider: "codex", model: "gpt-5.2-codex", label: "codex5.2", prompt: "Examine the codebase of project root, and think about its design. In your reply, include this exact token: {TOKEN}. Be brief." },
  { provider: "claude", model: "sonnet4.5", label: "claude-sonnet-4-5", prompt: "Examine the codebase of project root, and create a skill for debug backend. In your reply, include this exact token: {TOKEN}. Be brief." },
];

/**
 * Extract text from Pi output events (message_update with delta, etc.)
 */
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
 * Run one provider: submit prompt, connect N SSE clients, return results.
 */
async function runOneProvider(cfg, index) {
  const label = cfg.label || `${cfg.provider} (${cfg.model})`;
  const sessionId = `temp-smoke-${index}-${crypto.randomUUID()}`;
  const token = `SMOKE_SSE_${index}_${Date.now()}`;
  const prompt = cfg.prompt.replace("{TOKEN}", token);

  try {
    await submitPrompt(sessionId, cfg.provider, cfg.model, prompt);
  } catch (err) {
    return { label, index, submitError: err.message, results: [] };
  }

  const results = await Promise.all(
    Array.from({ length: NUM_SSE_CLIENTS }, (_, clientIdx) =>
      runOneSseClient(sessionId, clientIdx, token)
    )
  );
  return { label, index, submitError: null, results };
}

async function main() {
  console.error("[smoke] Pi RPC SSE multi-client smoke test");
  console.error("[smoke] SERVER_URL:", SERVER_URL);
  console.error("[smoke] NUM_SSE_CLIENTS:", NUM_SSE_CLIENTS);
  console.error("[smoke] SSE only (no WebSocket), single Pi RPC per session");
  console.error("[smoke] Running providers concurrently\n");

  const start = Date.now();

  const providerTasks = PROVIDERS.map((cfg, i) => runOneProvider(cfg, i));
  const providerResults = await Promise.all(providerTasks);

  let passed = true;
  for (const { label, index, submitError, results } of providerResults) {
    console.error(`[smoke] Provider ${index + 1}/${PROVIDERS.length}: ${label}`);

    if (submitError) {
      console.error(`[smoke]   Submit failed: ${submitError}`);
      passed = false;
      continue;
    }

    const tokens = results.map((r) => r.token);
    for (const r of results) {
      const hasOwnToken = r.fullOutput.includes(r.token);
      const hasOthersToken = tokens.some((t) => t !== r.token && r.fullOutput.includes(t));
      const gotExit = r.exitCode !== null;
      const noError = !r.error;

      const ok = hasOwnToken && !hasOthersToken && gotExit && noError;
      if (!ok) passed = false;

      const status = ok ? "PASS" : "FAIL";
      console.error(`[smoke]   Client ${r.clientIndex}: ${status}`);
      if (r.error) console.error(`           Error: ${r.error}`);
      if (!hasOwnToken) console.error(`           Missing own token in output`);
      if (hasOthersToken) console.error(`           CROSS-TALK: received another token!`);
      if (!gotExit) console.error(`           Did not receive exit event`);
      if (ok) {
        const preview = r.fullOutput.slice(0, 60).replace(/\n/g, " ");
        console.error(`           Output preview: "${preview}..."`);
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error("");
  console.error(`[smoke] Elapsed: ${elapsed}s`);
  if (passed) {
    console.error("[smoke] All clients passed. Pi RPC handles multiple SSE clients correctly.");
    process.exit(0);
  } else {
    console.error("[smoke] One or more clients failed.");
    process.exit(1);
  }
}

/**
 * Run one SSE client for a given session (connects after submit).
 */
function runOneSseClient(sessionId, clientIndex, token) {
  return new Promise((resolve) => {
    let fullOutput = "";
    let exitCode = null;
    let outputBuffer = "";
    let resolved = false;

    const url = `${SERVER_URL}/api/sessions/${encodeURIComponent(sessionId)}/stream?activeOnly=1`;
    const es = new EventSource(url);

    const finish = (err) => {
      if (resolved) return;
      resolved = true;
      try {
        es.close();
      } catch (_) {}
      resolve({
        clientIndex,
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

main().catch((err) => {
  console.error("[smoke] Fatal:", err);
  process.exit(1);
});
