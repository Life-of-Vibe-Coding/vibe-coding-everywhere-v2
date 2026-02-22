#!/usr/bin/env node
/**
 * Smoke test: verify Pi RPC can handle multiple clients running at the same time.
 *
 * Connects N clients concurrently, each submits a prompt, and we verify:
 * - Each client receives its own output (no cross-talk)
 * - Each client completes with exit
 * - No client receives another client's unique token in its output
 *
 * Usage:
 *   # Start server first:
 *   WORKSPACE_CWD=/path/to/workspace node server.js &
 *
 *   # Run smoke test (server must be running on port 3456):
 *   node scripts/smoke-pi-rpc-multi-client.mjs
 *
 *   # Or with custom server URL:
 *   SERVER_URL=http://localhost:3456 node scripts/smoke-pi-rpc-multi-client.mjs
 *
 *   # Number of concurrent clients (default 3):
 *   NUM_CLIENTS=5 node scripts/smoke-pi-rpc-multi-client.mjs
 */
import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3456";
const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS || "3", 10) || 3;
const PROMPT_TIMEOUT_MS = 120_000; // 2 min per client (LLM latency)
const PROMPT_PROVIDER = process.env.PROMPT_PROVIDER || "gemini";
const PROMPT_MODEL = process.env.PROMPT_MODEL || "gemini-2.5-flash";

/**
 * Extract text from Pi output events (message_update with text_delta, etc.)
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
 * Run a single client: connect, submit prompt with unique token, collect output.
 * @param {number} clientIndex - 0-based index
 * @returns {Promise<{clientIndex: number; fullOutput: string; exitCode: number | null; error?: string}>}
 */
function runClient(clientIndex) {
  const token = `SMOKE_TOKEN_${clientIndex}_${Date.now()}`;
  const prompt = `In your reply, you MUST include this exact token: ${token}. What is 1+1? Answer in one word.`;

  return new Promise((resolve) => {
    let fullOutput = "";
    let exitCode = null;
    let outputBuffer = "";
    let resolved = false;

    const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

    const finish = (err) => {
      if (resolved) return;
      resolved = true;
      socket.removeAllListeners();
      socket.disconnect();
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
          const text = extractText(parsed);
          if (text) fullOutput += text;
        } catch {
          fullOutput += trimmed + "\n";
        }
      }
    }

    socket.on("connect", () => {
      socket.emit("submit-prompt", {
        prompt,
        provider: PROMPT_PROVIDER,
        model: PROMPT_MODEL,
      });
    });

    socket.on("output", onOutput);
    socket.on("exit", (data) => {
      exitCode = data?.exitCode ?? 0;
      clearTimeout(timeout);
      finish();
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      finish(`Connect error: ${err.message}`);
    });
    socket.on("disconnect", (reason) => {
      if (!resolved) {
        clearTimeout(timeout);
        finish(`Disconnected: ${reason}`);
      }
    });
  });
}

async function main() {
  console.error("[smoke] Pi RPC multi-client smoke test");
  console.error("[smoke] SERVER_URL:", SERVER_URL);
  console.error("[smoke] NUM_CLIENTS:", NUM_CLIENTS);
  console.error("[smoke] Starting", NUM_CLIENTS, "clients concurrently...\n");

  const start = Date.now();

  // Run all clients in parallel
  const results = await Promise.all(
    Array.from({ length: NUM_CLIENTS }, (_, i) => runClient(i))
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  let passed = true;
  const tokens = results.map((r) => r.token);

  for (const r of results) {
    const hasOwnToken = r.fullOutput.includes(r.token);
    const hasOthersToken = tokens.some((t) => t !== r.token && r.fullOutput.includes(t));
    const gotExit = r.exitCode !== null;
    const noError = !r.error;

    const ok = hasOwnToken && !hasOthersToken && gotExit && noError;
    if (!ok) passed = false;

    const status = ok ? "PASS" : "FAIL";
    console.error(`[smoke] Client ${r.clientIndex}: ${status}`);
    if (r.error) console.error(`         Error: ${r.error}`);
    if (!hasOwnToken) console.error(`         Missing own token in output`);
    if (hasOthersToken) console.error(`         CROSS-TALK: received another client's token!`);
    if (!gotExit) console.error(`         Did not receive exit event`);
    if (ok) {
      const preview = r.fullOutput.slice(0, 60).replace(/\n/g, " ");
      console.error(`         Output preview: "${preview}..."`);
    }
  }

  console.error("");
  console.error(`[smoke] Elapsed: ${elapsed}s`);
  if (passed) {
    console.error("[smoke] All clients passed. Pi RPC handles multiple concurrent clients correctly.");
    process.exit(0);
  } else {
    console.error("[smoke] One or more clients failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[smoke] Fatal:", err);
  process.exit(1);
});
