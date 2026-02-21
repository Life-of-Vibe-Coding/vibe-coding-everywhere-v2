import type { EventContext, EventHandler } from "../types";
import {
  applySessionStartMetadata,
  appendSnapshotTextDelta,
  appendToolUseDisplayLine,
  collectTextFromContentBlocks,
  type ProviderContentBlock,
} from "../types";

/**
 * Register Gemini CLI-specific event handlers into the given registry.
 *
 * Gemini sends these event types:
 * - "init"    → session start (session_id, model, cwd)
 * - "message" → assistant content (role: "model", parts/content)
 */
export function registerGeminiHandlers(
  registry: Map<string, EventHandler>,
  ctx: EventContext
): void {
  /** Gemini CLI sends "init" instead of "system" for session start. */
  registry.set("init", (data) => {
    applySessionStartMetadata(data, ctx);
  });

  /**
   * Gemini CLI sends "message" for assistant content.
   * Handles two formats:
   *  1. Direct string content with optional delta flag:
   *     {"type":"message","role":"assistant","content":"text...","delta":true}
   *  2. Array content (parts/content) similar to Claude:
   *     {"type":"message","role":"model","message":{"content":[{type:"text",text:"..."}]}}
   */
  registry.set("message", (data) => {
    const role = data.role as string | undefined;
    // Skip user messages (echoed back by Gemini CLI)
    if (role === "user") return;
    // Only handle assistant/model messages
    if (role !== "assistant" && role !== "model") return;

    const isDelta = !!data.delta;
    const content = data.content;

    // Format 1: Direct string content (Gemini streaming delta / full message)
    if (typeof content === "string") {
      if (!content) return;
      if (isDelta) {
        // Delta chunk: append directly
        ctx.appendAssistantText(content);
      } else {
        // Full message: deduplicate against already-displayed content
        appendSnapshotTextDelta(ctx, content);
      }
      return;
    }

    // Format 2: Array content (tool_use blocks, text parts, etc.)
    const msg = data.message ?? data;
    const rawContents = (msg as Record<string, unknown>).content ?? (msg as Record<string, unknown>).parts;
    const contents: ProviderContentBlock[] =
      Array.isArray(rawContents) ? rawContents : [];

    for (const c of contents) {
      if (c.type === "tool_use" && c.name) {
        appendToolUseDisplayLine(ctx, c.name, c.input);
      }
    }
    appendSnapshotTextDelta(ctx, collectTextFromContentBlocks(contents));
  });
}
