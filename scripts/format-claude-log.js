#!/usr/bin/env node
/**
 * Parse AI provider output log (NDJSON) and print human-readable text.
 * Usage: node scripts/format-claude-log.js [path-to-log]
 *        node scripts/format-claude-log.js --provider claude|gemini
 *        If no path given, uses latest logs/*-output-*.log
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLatestLogPath(provider) {
  const logsDir = path.join(__dirname, "..", "logs");
  if (!fs.existsSync(logsDir)) return null;

  // Collect log files from provider subdirectories: logs/claude/, logs/gemini/
  const providers = provider ? [provider] : ["claude", "gemini"];
  const files = [];
  for (const p of providers) {
    const subDir = path.join(logsDir, p);
    if (!fs.existsSync(subDir)) continue;
    const prefix = `${p}-output-`;
    for (const f of fs.readdirSync(subDir)) {
      if (f.endsWith(".log") && f.startsWith(prefix)) {
        const fullPath = path.join(subDir, f);
        files.push({ path: fullPath, mtime: fs.statSync(fullPath).mtime });
      }
    }
  }

  // Also check legacy flat files in logs/ for backward compatibility
  for (const f of fs.readdirSync(logsDir)) {
    if (!f.endsWith(".log")) continue;
    const matchesProvider = provider
      ? f.startsWith(`${provider}-output-`)
      : f.startsWith("claude-output-") || f.startsWith("gemini-output-");
    if (matchesProvider) {
      const fullPath = path.join(logsDir, f);
      files.push({ path: fullPath, mtime: fs.statSync(fullPath).mtime });
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].path : null;
}

function formatToolUseInput(input) {
  if (!input || typeof input !== "object") return "";
  const parts = [];
  if (input.file_path) parts.push(`file: ${path.basename(String(input.file_path))}`);
  if (input.old_string != null) {
    const s = String(input.old_string);
    parts.push(`old: ${s.length > 80 ? s.slice(0, 77) + "..." : s}`);
  }
  if (input.new_string != null) {
    const s = String(input.new_string);
    parts.push(`new: ${s.length > 80 ? s.slice(0, 77) + "..." : s}`);
  }
  if (input.command) parts.push(`command: ${String(input.command).slice(0, 60)}`);
  if (input.questions && Array.isArray(input.questions)) {
    input.questions.forEach((q, i) => {
      const header = q.header || `Q${i + 1}`;
      const text = q.question || "";
      parts.push(`${header}: ${text.slice(0, 100)}`);
      if (q.options && q.options.length)
        parts.push(`  options: ${q.options.map((o) => o.label || o).join(", ")}`);
    });
  }
  const rest = { ...input };
  delete rest.file_path;
  delete rest.old_string;
  delete rest.new_string;
  delete rest.command;
  delete rest.questions;
  const keys = Object.keys(rest).filter((k) => rest[k] !== undefined && rest[k] !== null);
  keys.forEach((k) => parts.push(`${k}: ${JSON.stringify(rest[k]).slice(0, 60)}`));
  return parts.join(" | ");
}

function formatToolResultContent(content) {
  if (content == null) return "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.length > 300) return trimmed.slice(0, 297) + "...";
    return trimmed;
  }
  return JSON.stringify(content).slice(0, 200);
}

function extractAssistantContent(msg) {
  const out = [];
  const content = msg?.content;
  if (!Array.isArray(content)) return out;
  for (const block of content) {
    if (block.type === "text" && block.text) {
      out.push({ kind: "text", value: block.text });
    } else if (block.type === "tool_use" && block.name) {
      const summary = formatToolUseInput(block.input);
      out.push({ kind: "tool_use", name: block.name, value: summary });
    }
  }
  return out;
}

function extractUserContent(msg) {
  const out = [];
  const content = msg?.content;
  if (!Array.isArray(content)) return out;
  for (const block of content) {
    if (block.type === "tool_result" && block.content != null) {
      out.push({ kind: "tool_result", value: formatToolResultContent(block.content) });
    }
  }
  return out;
}

function main() {
  let logPath = null;
  let provider = null;

  // Parse args: support --provider claude|gemini or a direct path
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--provider" && args[i + 1]) {
      provider = args[i + 1];
      i++;
    } else if (!args[i].startsWith("-")) {
      logPath = args[i];
    }
  }

  logPath = logPath || getLatestLogPath(provider);
  if (!logPath || !fs.existsSync(logPath)) {
    console.error("Usage: node scripts/format-claude-log.js [path-to-log]");
    console.error("       node scripts/format-claude-log.js --provider claude|gemini");
    console.error("No log file found. Put path or run from repo with logs/.");
    process.exit(1);
  }

  // Detect provider from filename for display
  const basename = path.basename(logPath);
  const detectedProvider = basename.startsWith("gemini-") ? "Gemini" : "Claude";

  const raw = fs.readFileSync(logPath, "utf8");
  const lines = raw.split("\n").map((s) => s.trim()).filter((s) => s.startsWith("{"));

  const sections = [];
  let turn = 0;

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const type = obj.type;

    if (type === "system" && obj.subtype === "init") {
      sections.push({
        role: "session",
        title: "Session started",
        lines: [
          `CWD: ${obj.cwd || ""}`,
          `Model: ${obj.model || ""}`,
          `Session ID: ${obj.session_id || ""}`,
        ].filter(Boolean),
      });
      continue;
    }

    if (type === "assistant" && obj.message) {
      turn += 1;
      const blocks = extractAssistantContent(obj.message);
      for (const b of blocks) {
        if (b.kind === "text") {
          sections.push({ role: "assistant", turn, kind: "text", text: b.value });
        } else if (b.kind === "tool_use") {
          sections.push({
            role: "assistant",
            turn,
            kind: "tool",
            name: b.name,
            summary: b.value,
          });
        }
      }
      continue;
    }

    if (type === "user" && obj.message) {
      const blocks = extractUserContent(obj.message);
      for (const b of blocks) {
        if (b.kind === "tool_result" && b.value) {
          sections.push({ role: "user", kind: "tool_result", text: b.value });
        }
      }
      continue;
    }

    if (type === "result") {
      if (obj.result) {
        sections.push({ role: "result", kind: "summary", text: obj.result });
      }
      const denials = obj.permission_denials;
      if (Array.isArray(denials) && denials.length > 0) {
        for (const d of denials) {
          const name = d.tool_name || d.tool || "tool";
          const input = d.tool_input;
          if (input?.questions) {
            input.questions.forEach((q) => {
              const header = q.header || "";
              const question = q.question || "";
              const opts = q.options?.map((o) => o.label || o).join(", ") || "";
              sections.push({
                role: "result",
                kind: "denial_question",
                tool: name,
                header,
                question,
                options: opts,
              });
            });
          } else {
            sections.push({ role: "result", kind: "denial", tool: name, input: JSON.stringify(input).slice(0, 120) });
          }
        }
      }
      sections.push({
        role: "result",
        kind: "stats",
        lines: [
          obj.subtype === "success" ? "Success" : obj.subtype || "Result",
          obj.duration_ms != null ? `Duration: ${obj.duration_ms} ms` : "",
          obj.num_turns != null ? `Turns: ${obj.num_turns}` : "",
          obj.total_cost_usd != null ? `Cost: $${obj.total_cost_usd}` : "",
        ].filter(Boolean),
      });
    }
  }

  // Print human-readable
  const sep = "─".repeat(60);
  console.log(`\n# ${detectedProvider} log (human-readable)\n`);
  console.log(`File: ${logPath}\n`);

  let currentTurn = 0;
  for (const s of sections) {
    if (s.role === "session") {
      console.log(sep);
      console.log("SESSION");
      console.log(sep);
      s.lines.forEach((l) => console.log("  " + l));
      console.log("");
      continue;
    }

    if (s.role === "assistant") {
      if (s.turn !== currentTurn) {
        currentTurn = s.turn;
        console.log(sep);
        console.log(`Turn ${currentTurn} — Claude`);
        console.log(sep);
      }
      if (s.kind === "text") {
        console.log(s.text);
        console.log("");
      } else if (s.kind === "tool") {
        console.log(`[Tool: ${s.name}] ${s.summary}`);
        console.log("");
      }
      continue;
    }

    if (s.role === "user" && s.kind === "tool_result") {
      console.log("↳ Tool result:");
      console.log(s.text.slice(0, 500) + (s.text.length > 500 ? "..." : ""));
      console.log("");
      continue;
    }

    if (s.role === "result") {
      console.log(sep);
      console.log("RESULT");
      console.log(sep);
      if (s.kind === "summary") {
        console.log(s.text);
        console.log("");
      }
      if (s.kind === "denial_question") {
        console.log(`[Permission denied: ${s.tool}] ${s.header ? s.header + " — " : ""}${s.question}`);
        if (s.options) console.log("  Options: " + s.options);
        console.log("");
      }
      if (s.kind === "denial") {
        console.log(`[Permission denied: ${s.tool}] ${s.input}`);
        console.log("");
      }
      if (s.lines && s.lines.length) {
        s.lines.forEach((l) => console.log("  " + l));
        console.log("");
      }
    }
  }

  console.log(sep);
  console.log("(end of log)");
}

main();
