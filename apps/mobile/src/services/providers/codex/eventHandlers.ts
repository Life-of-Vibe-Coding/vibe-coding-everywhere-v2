import type { EventContext, EventHandler } from "../types";
import { appendSnapshotTextDelta, appendToolUseDisplayLine, formatToolUseForDisplay } from "../types";

/**
 * Codex errors that mean the saved thread is invalid (e.g. state db missing rollout path for thread).
 * We match only this exact case so other "state db" errors do not clear the session.
 */
const SESSION_INVALID_PATTERNS = ["missing rollout path for thread"];

function isSessionInvalidError(message: string): boolean {
  const lower = message.toLowerCase();
  return SESSION_INVALID_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function normalizeCodexErrorMessage(raw: string, ctx: EventContext): string {
  if (isSessionInvalidError(raw)) {
    ctx.setSessionId?.(null);
    return "This session is no longer available. Start a new chat to continue.";
  }
  return raw;
}

/**
 * Register normalized Codex event handlers (mapped from codex app-server RPC events).
 *
 * Codex sends: thread.started, turn.started, turn.completed, turn.failed,
 * item.started, item.updated, item.completed, error.
 */
export function registerCodexHandlers(
  registry: Map<string, EventHandler>,
  ctx: EventContext
): void {
  registry.set("thread.started", (data) => {
    const threadId = data.thread_id as string | undefined;
    if (threadId) {
      ctx.setSessionId?.(threadId);
      console.log("[session] Codex thread_id:", threadId);
    }
  });

  registry.set("turn.started", () => {});

  registry.set("turn.completed", () => {});

  registry.set("turn.failed", (data) => {
    const err = data.error as { message?: string } | undefined;
    const raw = err?.message ?? "Turn failed.";
    const msg = normalizeCodexErrorMessage(raw, ctx);
    ctx.addMessage("system", msg);
  });

  registry.set("item.started", (data) => {
    const item = data.item as { type?: string; command?: string; tool?: string; arguments?: unknown } | undefined;
    if (item?.type === "command_execution" && typeof item.command === "string" && item.command) {
      appendToolUseDisplayLine(ctx, "Bash", { command: item.command });
      ctx.setCurrentActivity(formatToolUseForDisplay("Bash", { command: item.command }));
    } else if (item?.type === "mcp_tool_call" && item.tool) {
      ctx.setCurrentActivity(formatToolUseForDisplay(item.tool, item.arguments ?? {}));
    }
  });

  registry.set("item.updated", (data) => {
    const item = data.item as { type?: string; text?: string } | undefined;
    if (item?.type === "agent_message" && typeof item.text === "string" && item.text) {
      // Codex may send cumulative snapshots (full text so far) or deltas.
      // appendSnapshotTextDelta appends only the new part in both cases.
      appendSnapshotTextDelta(ctx, item.text);
    }
  });

  registry.set("item.completed", (data) => {
    const item = data.item as {
      type?: string;
      text?: string;
      command?: string;
      changes?: Array<{ path?: string; kind?: string }>;
      server?: string;
      tool?: string;
      arguments?: unknown;
      status?: string;
      exit_code?: number;
    } | undefined;
    if (!item) return;
    if (item.type === "agent_message" && typeof item.text === "string" && item.text) {
      // addMessage ensures the response appears when appendAssistantText (from item.updated)
      // hasn't flushed to React yet. Dedup: skip if ref already has full content (streaming added it).
      // Server may send item.completed with a subset (e.g. summary only); skip when streamed content
      // already contains it to avoid duplicate Summary section.
      const current = ctx.getCurrentAssistantContent();
      const alreadyShown = current === item.text || current.includes(item.text);
      if (!alreadyShown) {
        ctx.addMessage("assistant", item.text);
      }
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/90b82ca6-2c33-4285-83a2-301e58d458f5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'90f72f'},body:JSON.stringify({sessionId:'90f72f',location:'eventHandlers.ts:item.completed',message:'agent_message completed',data:{currentLen:current.length,itemTextLen:item.text.length,alreadyShown,addMessageCalled:!alreadyShown},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return;
    }
    if (item.type === "command_execution") {
      ctx.setCurrentActivity(null);
      return;
    }
    if (item.type === "file_change" && Array.isArray(item.changes) && item.changes.length > 0) {
      for (const ch of item.changes) {
        const kind = ch.kind ?? "change";
        const pathStr = ch.path ?? "";
        appendToolUseDisplayLine(
          ctx,
          kind === "create" ? "Write" : kind === "edit" ? "Edit" : "Read",
          pathStr ? { file_path: pathStr, path: pathStr } : {}
        );
      }
      return;
    }
    if (item.type === "mcp_tool_call" && item.tool) {
      appendToolUseDisplayLine(ctx, item.tool, item.arguments ?? {});
      ctx.setCurrentActivity(null);
    }
  });

  registry.set("error", (data) => {
    const raw = (data.message as string) ?? "Error.";
    const msg = normalizeCodexErrorMessage(raw, ctx);
    ctx.addMessage("system", msg);
  });
}
