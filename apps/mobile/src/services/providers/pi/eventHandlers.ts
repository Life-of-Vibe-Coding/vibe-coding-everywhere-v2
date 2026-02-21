import type { EventContext, EventHandler } from "../types";
import { appendSnapshotTextDelta, appendToolUseDisplayLine, formatToolUseForDisplay } from "../types";

/**
 * Register Pi RPC-specific event handlers.
 *
 * Pi sends native RPC events:
 * - message_update (with assistantMessageEvent: text_delta, toolcall_end, etc.)
 * - tool_execution_start, tool_execution_update, tool_execution_end
 * - agent_start, agent_end, turn_start, turn_end
 * - response, extension_error
 *
 * extension_ui_request is transformed to AskUserQuestion on the server.
 */
export function registerPiHandlers(
  registry: Map<string, EventHandler>,
  ctx: EventContext
): void {
  /** Pi message_update: stream text deltas and tool calls. */
  registry.set("message_update", (data) => {
    const ev = data.assistantMessageEvent as {
      type?: string;
      delta?: string;
      content?: string;
      toolCall?: { id?: string; name?: string; arguments?: Record<string, unknown> };
    } | undefined;
    if (!ev) return;

    if (ev.type === "text_delta" && typeof ev.delta === "string" && ev.delta) {
      ctx.appendAssistantText(ev.delta);
    }
    if (ev.type === "toolcall_end" && ev.toolCall?.name) {
      appendToolUseDisplayLine(ctx, ev.toolCall.name, ev.toolCall.arguments ?? {});
    }
  });

  /** Pi tool_execution_start: show tool being executed. */
  registry.set("tool_execution_start", (data) => {
    const toolName = data.toolName as string | undefined;
    const args = data.args as Record<string, unknown> | undefined;
    if (toolName) {
      appendToolUseDisplayLine(ctx, toolName, args ?? {});
      ctx.setCurrentActivity(formatToolUseForDisplay(toolName, args ?? {}));
    }
  });

  /** Pi tool_execution_update: optionally show streaming output (partialResult). */
  registry.set("tool_execution_update", () => {
    // Streaming tool output - could append to chat; Pi typically streams via partialResult.
    // Skip to avoid duplicating with tool_execution_end.
  });

  /** Pi tool_execution_end: tool completed. */
  registry.set("tool_execution_end", () => {
    ctx.setCurrentActivity(null);
  });

  /** Pi turn_end: may contain final message. Use appendSnapshotTextDelta to avoid duplicate
   * when we already streamed content via message_update (text_delta). */
  registry.set("turn_end", (data) => {
    const msg = data.message as { content?: Array<{ type?: string; text?: string }> } | undefined;
    if (msg?.content) {
      const text = msg.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("");
      if (text) appendSnapshotTextDelta(ctx, text);
    }
  });

  /** Pi agent_start: session start (claude-started emitted by server). */
  registry.set("agent_start", () => {
    // Server emits claude-started; no extra UI.
  });

  /** Pi agent_end: session complete. */
  registry.set("agent_end", () => {
    // Session ended; server emits exit.
  });

  /** Pi response: command acknowledgment (success) - no UI. */
  registry.set("response", () => {
    // Ignore successful command responses.
  });

  /** Pi extension_error: server emits error to output. */
  registry.set("extension_error", () => {
    // Server already emits error to output.
  });
}
