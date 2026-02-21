# Systematic Debug: Terminal-Runner No Following Message

**Date:** 2026-02-21  
**Artifact:** `workspace_for_testing/.pi/sessions/2026-02-21T14-24-00-699Z_fabe6dfe-a4be-4aea-a985-4776d0cd97ff.jsonl`  
**Symptom:** Session ends at line 18 (assistant message with bash toolCall); no toolResult or subsequent messages appear.

---

## Phase 1: Root Cause Investigation

### 1. Evidence Gathered

**Session structure (lines 1–18):**
- Lines 1–4: session init, model, user message "Render shophub"
- Lines 5–17: Assistant → toolCall (read, bash) → toolResults; validation passes
- **Line 18:** Assistant message with single bash toolCall to start backend + frontend
- **No line 19:** No toolResult for that bash

**The last bash command (line 18):**
```bash
# Start backend: venv + pip install + python run.py &
cd .../shophub/backend && source venv/bin/activate && pip install -q -r requirements.txt && python3 run.py > backend.log 2>&1 &

# Start frontend: npm install + npm run dev &
cd .../shophub && npm install --silent > /dev/null 2>&1 && npm run dev > frontend.log 2>&1 &

sleep 5
```

**Execution flow:**
1. `pip install -q -r requirements.txt` — runs in foreground (5–30s typical)
2. `python3 run.py ... &` — backgrounds
3. `npm install --silent` — runs in foreground (5–60s, even with existing node_modules)
4. `npm run dev ... &` — backgrounds
5. `sleep 5`
6. Script exits → toolResult

**Estimated total duration:** 15–95+ seconds.

### 2. Comparison with Working Session

Session `2026-02-21T14-21-57` shows:
- Quick bash commands (find, ls, validation) → toolResult in 1–2s
- Backend start (pip install failed) → toolResult in ~8s
- Backend retry with venv → would need longer (pip in venv + sleep 3)

**Conclusion:** Short bash commands (up to ~10s) reliably produce toolResults. The failing command runs 30–120+ seconds.

### 3. Data Flow

```
Pi CLI stdout (JSON events) → piRpcSession.js child.stdout → handlePiEvent → emitOutputLine
                                                                              ├→ socket.emit("output") → mobile client
                                                                              └→ piIoOutputStream (llm-cli-io output.log)
```

The session JSONL is written by **Pi CLI** (external binary), not by this server. If Pi never emits a toolResult, the session file stops at the last written event.

### 4. Root Cause Hypotheses (Ranked)

| # | Hypothesis | Likelihood | Rationale |
|---|------------|------------|-----------|
| 1 | **Tool execution timeout** | High | Pi CLI or its tool executor may impose a 30–60s timeout. Bash runs 30–120s → gets killed before exit → no toolResult. |
| 2 | **Session/connection closed early** | Medium | User closed app or connection dropped before bash finished. Session snapshot shows last state before close. |
| 3 | **Approval gate (extension_ui_request)** | Medium | Pi may emit `extension_ui_request` with method `confirm` before running bash. If user never approves, Pi waits indefinitely; no toolResult. (Session file would not show extension_ui if Pi hasn't flushed it.) |
| 4 | **Pi crash/hang during long bash** | Low | Possible but no crash evidence. |

### 5. Terminal Rules Mismatch

`piRpcSession.js` injects:
> "do not use nohup, &, or any pattern that detaches or leaves processes hanging"

The agent used `&` to background backend and frontend. That does not prevent the bash script from completing (it ends with `sleep 5`). The blocking steps are `pip install` and `npm install`, both in the foreground, which drive the long runtime.

---

## Phase 2: Recommendations

### A. Add Diagnostic Instrumentation (Per Systematic Debugging Skill)

**1. Log tool execution timing in Pi/session:**

- When Pi emits `tool_execution_start` for bash, log start timestamp.
- When Pi emits `tool_execution_end` or timeout, log duration.
- Helps distinguish timeout vs. early session close.

**2. Check Pi CLI for tool timeout:**

- Inspect Pi CLI docs/source for tool execution timeout.
- If timeout exists and is &lt; 90s, that explains the missing toolResult.

**3. Check for approval gate before bash:**

- Log all `extension_ui_request` events and their methods.
- If a `confirm` is sent before bash and no `extension_ui_response` is received, Pi will block; user needs to approve.

### B. Mitigations

**1. Split long command chains (quick win):**

Have the terminal-runner skill suggest:

- One bash call: start backend only (`cd backend && source venv/bin/activate && pip install && python run.py &`), wait for toolResult.
- Next bash call: start frontend only (`cd shophub && npm run dev &`).
- Separate calls keep each under typical timeout.

**2. Avoid foreground install in same script as servers:**

- Run `pip install` and `npm install` in earlier validation/bash steps.
- Final “start services” script only does `source venv/bin/activate && python run.py &` and `npm run dev &`, reducing runtime to a few seconds.

**3. Update terminal-runner skill:**

- Add: “Prefer splitting long operations (e.g. pip install + npm install + server start) across multiple bash calls. Each call should complete in under ~30 seconds when possible.”

---

## Phase 3: Verification Steps

1. **Run a minimal repro:** Same bash command manually and measure time-to-exit.
2. **Reproduce with instrumentation:** Add logging for tool start/end and extension_ui; trigger “Render shophub” again.
3. **If Pi exposes a tool timeout:** Compare timeout value with measured bash duration.

---

## Summary

| Item | Finding |
|------|---------|
| **Root cause** | Most likely: bash exceeds Pi CLI tool execution timeout (if &lt; ~90s), or session closed before completion. |
| **Contributing factor** | Single bash script runs pip install + npm install + sleep 5 (30–120+ seconds). |
| **Fix direction** | Split start-backend and start-frontend into separate bash calls; move installs to earlier validation steps or separate calls. |
