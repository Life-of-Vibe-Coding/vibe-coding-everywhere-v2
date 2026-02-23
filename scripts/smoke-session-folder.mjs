#!/usr/bin/env node
/**
 * Smoke test: verify session folder is created at sessions/{sessionId}/ and NOT sessions-{sessionId}.
 *
 * The Pi CLI, when given --session-dir as sessions/sessionId, would create a sibling folder
 * "sessions-{sessionId}" (path separators replaced by -). The fix passes only the base
 * sessions/ dir so Pi uses our pre-created sessions/{sessionId}/.
 *
 * Verifies:
 * - sessions/{sessionId}/ exists and contains a .jsonl file
 * - sessions-{sessionId} does NOT exist in .pi/agent/
 *
 * Usage:
 *   node server.js &   # Start server (ensure it has the piRpcSession fix)
 *   node scripts/smoke-session-folder.mjs
 *
 *   SERVER_URL=http://localhost:3456 node scripts/smoke-session-folder.mjs
 *   WAIT_AFTER_SUBMIT_MS=5000 node scripts/smoke-session-folder.mjs  # shorter wait
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const SESSIONS_ROOT = path.join(projectRoot, ".pi", "agent");
const SESSIONS_BASE = path.join(SESSIONS_ROOT, "sessions");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3456";
const WAIT_AFTER_SUBMIT_MS = parseInt(process.env.WAIT_AFTER_SUBMIT_MS || "8000", 10);

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

async function main() {
  console.error("[smoke-session-folder] Session folder structure smoke test");
  console.error("[smoke-session-folder] SERVER_URL:", SERVER_URL);
  console.error("[smoke-session-folder] SESSIONS_ROOT:", SESSIONS_ROOT);
  console.error("[smoke-session-folder] WAIT_AFTER_SUBMIT_MS:", WAIT_AFTER_SUBMIT_MS);
  console.error("");

  const sessionId = `smoke-folder-${crypto.randomUUID()}`;

  console.error(`[smoke-session-folder] Submitting prompt (session ${sessionId.slice(0, 20)}...)`);
  try {
    await submitPrompt(
      sessionId,
      "codex",
      "gpt-5.1-codex-mini",
      "Reply with exactly: OK"
    );
  } catch (err) {
    console.error("[smoke-session-folder] FAIL: Submit error:", err.message);
    process.exit(1);
  }

  console.error(`[smoke-session-folder] Waiting ${WAIT_AFTER_SUBMIT_MS}ms for Pi to run...`);
  await new Promise((r) => setTimeout(r, WAIT_AFTER_SUBMIT_MS));

  let passed = true;

  const correctPath = path.join(SESSIONS_BASE, sessionId);
  const wrongPath = path.join(SESSIONS_ROOT, `sessions-${sessionId}`);

  if (!fs.existsSync(correctPath)) {
    console.error(`[smoke-session-folder] FAIL: Expected folder does not exist: ${correctPath}`);
    passed = false;
  } else {
    const entries = fs.readdirSync(correctPath);
    const jsonl = entries.find((n) => n.endsWith(".jsonl"));
    if (!jsonl) {
      console.error(`[smoke-session-folder] FAIL: No .jsonl file in ${correctPath}`);
      passed = false;
    } else {
      console.error(`[smoke-session-folder] PASS: sessions/${sessionId}/ exists with ${jsonl}`);
    }
  }

  if (fs.existsSync(wrongPath)) {
    console.error(`[smoke-session-folder] FAIL: Wrong folder exists (Pi created sessions-{id}): ${wrongPath}`);
    passed = false;
  } else {
    console.error(`[smoke-session-folder] PASS: sessions-${sessionId} does not exist`);
  }

  console.error("");
  if (passed) {
    console.error("[smoke-session-folder] Session folder structure test PASSED.");
    process.exit(0);
  } else {
    console.error("[smoke-session-folder] Session folder structure test FAILED.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[smoke-session-folder] Fatal:", err);
  process.exit(1);
});
