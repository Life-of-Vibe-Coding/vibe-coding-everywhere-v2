/**
 * Pi-native event dispatcher for AI stream output.
 *
 * Consumes Pi RPC protocol events (message_update, turn_end, tool_execution_*, etc.)
 * and routes them to the appropriate handler. Handles permission_denials and
 * AskUserQuestion before type; falls back to appending as text for unknown types.
 */
import type { PermissionDenial, PendingAskUserQuestion } from "../../core/types";
import type { EventContext, EventHandler } from "./types";
import { appendSnapshotTextDelta, appendToolUseDisplayLine, formatToolUseForDisplay } from "./types";
import { isAskUserQuestionPayload } from "./stream";

function normalizeAskUserQuestionPayload(data: Record<string, unknown>): PendingAskUserQuestion | null {
  const toolUseId = String(data.tool_use_id ?? "");
  const input = data.tool_input as Record<string, unknown> | undefined;
  const questions = input?.questions as Array<{ question?: string; header: string; options: Array<{ label: string; description?: string }>; multiSelect?: boolean }> | undefined;
  if (!toolUseId || !Array.isArray(questions) || questions.length === 0) return null;
  const uuid = data.uuid ?? input?.uuid;
  return {
    tool_use_id: toolUseId,
    uuid: uuid != null ? String(uuid) : undefined,
    questions: questions.map((q) => ({
      question: q.question,
      header: q.header ?? "",
      options: Array.isArray(q.options) ? q.options.map((o) => ({ label: String(o?.label ?? ""), description: o?.description != null ? String(o.description) : undefined })) : [],
      multiSelect: !!q.multiSelect,
    })),
  };
}

/** AskUserQuestion is handled by the question modal. Returns filtered list and extracted AskUserQuestion payload if any. */
function processPermissionDenials(
  denials: PermissionDenial[],
  topLevelData: Record<string, unknown>
): { filteredDenials: PermissionDenial[]; askUserQuestionPayload: Record<string, unknown> | null } {
  let askPayload: Record<string, unknown> | null = null;
  const filtered = denials.filter((d) => {
    const tool = d.tool_name ?? d.tool ?? "";
    if (String(tool).trim() !== "AskUserQuestion") return true;
    const input = (d as Record<string, unknown>).tool_input as Record<string, unknown> | undefined;
    if (input && Array.isArray(input.questions) && input.questions.length > 0) {
      askPayload = {
        tool_name: "AskUserQuestion",
        tool_use_id: (d as Record<string, unknown>).tool_use_id,
        tool_input: input,
        uuid: topLevelData.uuid ?? input.uuid,
      };
    }
    return false;
  });
  return { filteredDenials: filtered, askUserQuestionPayload: askPayload };
}

/**
 * Registry of AI stream event handlers (Strategy pattern).
 * Combines provider-specific handlers with shared handlers.
 * Extend by adding new entries to the map; dispatcher logic stays unchanged (Open-Closed).
 */
function createHandlerRegistry(ctx: EventContext): Map<string, EventHandler> {
  const registry = new Map<string, EventHandler>();

  // Pi RPC handlers: message_update, tool_execution_*, agent_*, turn_end, response, extension_error
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
    if (ev.type === "thinking_start") {
      ctx.appendAssistantText("<think>\n");
    }
    if (ev.type === "thinking_delta" && typeof ev.delta === "string" && ev.delta) {
      ctx.appendAssistantText(ev.delta);
    }
    if (ev.type === "thinking_end") {
      ctx.appendAssistantText("\n</think>\n\n");
    }
    if (ev.type === "toolcall_end" && ev.toolCall?.name) {
      appendToolUseDisplayLine(ctx, ev.toolCall.name, ev.toolCall.arguments ?? {});
    }
  });
  registry.set("tool_execution_start", (data) => {
    const toolName = data.toolName as string | undefined;
    const args = data.args as Record<string, unknown> | undefined;
    if (toolName) {
      ctx.setCurrentActivity(formatToolUseForDisplay(toolName, args ?? {}));
    }
  });
  registry.set("tool_execution_update", () => {});
  registry.set("tool_execution_end", () => ctx.setCurrentActivity(null));
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
  registry.set("turn_start", () => {});
  registry.set("agent_start", () => {});
  registry.set("agent_end", () => {});
  registry.set("message_start", () => {});
  registry.set("message_end", () => {});
  registry.set("response", () => {});
  registry.set("extension_error", () => {});
  
  // Advanced Pi CLI feature events
  registry.set("auto_compaction_start", () => ctx.setCurrentActivity("Compacting context..."));
  registry.set("auto_compaction_end", () => ctx.setCurrentActivity(null));
  registry.set("auto_retry_start", () => ctx.setCurrentActivity("Retrying..."));
  registry.set("auto_retry_end", () => ctx.setCurrentActivity(null));

  // Shared handlers (used by Pi and other providers)
  const inputLikeHandler: EventHandler = (data) => {
    const tool = (data.tool_name ?? data.tool ?? "Tool") as string;
    const prompt =
      (data.prompt ?? data.message ?? data.description ?? "AI needs your input.") as string;
    ctx.setWaitingForUserInput(true);
    ctx.addMessage("system", `${tool} request:\n${prompt}\n(Type a response and press Enter)`);
  };
  registry.set("input", inputLikeHandler);
  registry.set("permission_request", inputLikeHandler);

  registry.set("user", () => {});

  registry.set("result", (data) => {
    const resultText = typeof (data as { result?: string }).result === "string"
      ? (data as { result: string }).result.trim()
      : "";
    if (!resultText) return;
    const current = ctx.getCurrentAssistantContent();
    // Append result summary only when it's not already the same as current content (avoid duplicate).
    const curTrim = current.trim();
    const resultTrim = resultText.trim();
    const willAppend = !curTrim.endsWith(resultTrim) && resultTrim.length > 0;
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/90b82ca6-2c33-4285-83a2-301e58d458f5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'90f72f'},body:JSON.stringify({sessionId:'90f72f',location:'eventDispatcher.ts:result',message:'result event',data:{resultLen:resultText.length,willAppend},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (willAppend) {
      ctx.appendAssistantText("\n\n<think>\n---\n\n" + resultText + "\n</think>\n\n");
    }
  });

  return registry;
}

/**
 * Create a dispatcher that routes Pi RPC stream events to the appropriate handler.
 */
export function createEventDispatcher(ctx: EventContext): (data: Record<string, unknown>) => void {
  const registry = createHandlerRegistry(ctx);
  return (data: Record<string, unknown>) => {
    if (Array.isArray(data.permission_denials) && data.permission_denials.length) {
      const list = data.permission_denials as PermissionDenial[];
      const deduped = ctx.deduplicateDenials(list);
      const { filteredDenials, askUserQuestionPayload } = processPermissionDenials(deduped, data);
      ctx.setPermissionDenials(filteredDenials.length > 0 ? filteredDenials : null);
      if (askUserQuestionPayload) {
        const pending = normalizeAskUserQuestionPayload(askUserQuestionPayload);
        if (pending) {
          ctx.setPendingAskQuestion(pending);
          ctx.setWaitingForUserInput(true);
        }
      }
    }
    if (isAskUserQuestionPayload(data)) {
      if (__DEV__) {
        console.log("[eventDispatcher] AskUserQuestion received", {
          tool_use_id: (data as Record<string, unknown>).tool_use_id,
          questionsCount: ((data as Record<string, unknown>).tool_input as { questions?: unknown[] })?.questions?.length,
        });
      }
      const pending = normalizeAskUserQuestionPayload(data);
      if (pending) {
        ctx.setPendingAskQuestion(pending);
        ctx.setWaitingForUserInput(true);
      }
      return;
    }
    const type = String(data.type ?? "");
    const handler = registry.get(type);
    if (handler) {
      handler(data, ctx);
    } else {
      if (typeof data === "string") ctx.appendAssistantText(`${data}\n`);
    }
  };
}

/** @deprecated Use createEventDispatcher */
export const createClaudeEventDispatcher = createEventDispatcher;
