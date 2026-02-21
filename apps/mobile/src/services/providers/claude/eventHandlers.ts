import type { EventContext, EventHandler } from "../types";
import {
  applySessionStartMetadata,
  appendSnapshotTextDelta,
  appendToolUseDisplayLine,
  collectTextFromContentBlocks,
  type ProviderContentBlock,
} from "../types";

/**
 * Register Claude CLI-specific event handlers into the given registry.
 *
 * Claude sends these event types:
 * - "system"       → session start (session_id, model, cwd)
 * - "assistant"    → assistant content (text, tool_use)
 * - "stream_event" → content_block_delta streaming
 */
export function registerClaudeHandlers(
  registry: Map<string, EventHandler>,
  ctx: EventContext
): void {
  /** Claude CLI sends "system" at session start. */
  registry.set("system", (data) => {
    applySessionStartMetadata(data, ctx);
  });

  /** Claude CLI sends "assistant" for assistant content. */
  registry.set("assistant", (data) => {
    const contents =
      (data.message as { content?: ProviderContentBlock[] })?.content ?? [];
    // Append human-readable lines for tool_use so the UI shows what Claude is doing. Start on a new line.
    for (const c of contents) {
      if (c.type === "tool_use" && c.name) {
        appendToolUseDisplayLine(ctx, c.name, c.input);
      }
    }
    // Only append delta so we don't re-display full text when a final "assistant" event arrives at stream end.
    appendSnapshotTextDelta(ctx, collectTextFromContentBlocks(contents));
  });

  /** Handle Claude's stream_event for content_block_delta. */
  registry.set("stream_event", (data) => {
    const ev = data.event as { type?: string; delta?: { type?: string; text?: string } } | undefined;
    if (ev?.type === "content_block_delta") {
      const text = ev.delta && typeof (ev.delta as { text?: string }).text === "string" ? (ev.delta as { text: string }).text : "";
      if (text) ctx.appendAssistantText(text);
    }
  });
}
