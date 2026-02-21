# Systematic Debug Investigation: Excessive Text & Duplicate Display

**Date:** 2026-02-21  
**Artifacts:** `logs/llm-cli-input-output/2026-02-21T08-49-18/pi-2026-02-21_17-04-14/2/output.log` (723 lines, 5.6MB)

## Phase 1: Root Cause Investigation

### Issue 1: Why is the log generating so much text content?

**Evidence gathered:**
- Log file: 723 lines, **5.6 MB** total
- Event breakdown:
  - `message_update`: **690 events** (95% of lines)
  - `message_start`/`message_end`: 8 each
  - `turn_start`/`turn_end`: 4 each
  - `tool_execution_*`: 7 total

- Line size growth (quadratic):
  - Line 7 (`message_update`): ~801 chars
  - Line 360 (`message_update`): ~8,148 chars
  - Line 721 (`message_update`): ~14,422 chars

**Root cause:** The Pi protocol sends `message_update` events where **each event embeds the full accumulated message** (thinking, text, tool calls, etc.), not just the delta. The server forwards and logs the raw JSON via `emitOutputLine(JSON.stringify(parsed) + "\n")` in `server/process/piRpcSession.js`. With 690 updates and each containing progressively larger content, total size grows as O(n × avg_message_size) ≈ O(n²).

**Data flow:**
```
Pi CLI stdout → handlePiEvent(parsed) → emitOutputLine(JSON.stringify(parsed))
                ↓
            piIoOutputStream.write() → output.log
            socket.emit("output", ...) → mobile client
```

### Issue 2: Why are certain text contents displayed twice on the frontend?

**Relevant code paths:**
1. `message_update` with `text_delta`: `eventDispatcher.ts` → `ctx.appendAssistantText(ev.delta)`
2. `turn_end`: `eventDispatcher.ts` → `appendSnapshotTextDelta(ctx, text)` where `text` = full message text from `msg.content`

**appendSnapshotTextDelta logic** (`types.ts`):
```typescript
const delta =
  current.length > 0 && fullText.startsWith(current)
    ? fullText.slice(current.length)
    : fullText;
if (delta) ctx.appendAssistantText(delta);
```

**Bug scenario:**
- When `fullText` is a **prefix** of `current` (streamed content > turn_end snapshot), `fullText.startsWith(current)` is false.
- Code falls through to `delta = fullText` and appends the entire `fullText`.
- Result: duplicate display (content already shown via `text_delta` is appended again).

Example:
- `current` = "Hello world" (from text_delta streaming)
- `fullText` = "Hello" (turn_end has slightly less or differing snapshot)
- `fullText.startsWith(current)` → false
- `delta = fullText` → append "Hello" → **duplicate**

**Additional case:** When `current` and `fullText` are equal or `current` already contains `fullText`, we must not append. The current logic handles equality via `delta = ""` when `fullText.startsWith(current)` and they're equal, but does not handle `current.startsWith(fullText)` (current longer).

## Phase 2: Pattern Analysis

- Working behavior: streaming `text_delta` appends correctly.
- Broken behavior: `turn_end` can re-append content when the snapshot differs slightly from streamed content.
- The `appendOverlapTextDelta` function exists for overlap handling but `turn_end` uses `appendSnapshotTextDelta`, which lacks the "fullText already in current" guard.

## Phase 3: Fixes

### Fix 1: Prevent duplicate display in appendSnapshotTextDelta

Add guards so we never append when `fullText` is already fully contained in `current`:

- If `current.startsWith(fullText)` or `current === fullText` → append nothing.
- If `fullText.startsWith(current)` → append only `fullText.slice(current.length)`.
- Otherwise → do not append (avoid duplication when relationship is ambiguous).

### Fix 2: Reduce log size (implemented)

In `server/process/piRpcSession.js`, `emitOutputLine` now writes a slim `message_update` event to the log file (event type + `assistantMessageEvent` with type, contentIndex, delta only), while still emitting the full event to the client. This reduces log size from O(n²) to roughly O(n).
