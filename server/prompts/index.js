/**
 * Prompt loading and management.
 */
import fs from "fs";
import path from "path";
import { PROMPTS_DIR } from "../config/index.js";

/**
 * Load a prompt from prompts/<name>.txt.
 * @param {string} name - Filename or path without extension (e.g. "page-render", "output/command")
 * @returns {string} Trimmed file content, or "" if file missing/unreadable
 */
export function loadPrompt(name) {
  if (!name || typeof name !== "string") return "";
  const base = name.replace(/\.txt$/, "");
  const filePath = path.join(PROMPTS_DIR, `${base}.txt`);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8").trim();
    }
  } catch (err) {
    console.warn("[prompts] Failed to load", filePath, err.message);
  }
  return "";
}

