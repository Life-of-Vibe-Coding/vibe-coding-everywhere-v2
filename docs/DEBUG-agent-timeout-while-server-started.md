# Systematic Debug: Agent Says Timeout While Server Has Started

**Date:** 2026-02-22  
**Symptom:** Server starts successfully (Uvicorn running, DB initializing in terminal), but the agent reports "Handling server start timeout."

---

## Phase 1: Root Cause Investigation

### 1. Evidence Gathered

**Terminal output (server actually started):**
- `INFO: Uvicorn running on http://0.0.0.0...`
- `INFO: Started reloader process [64183]`
- `INFO: Started server process [64185]`
- `INFO: Waiting for application startup.`
- `🚀 Initializing database...`
- `INFO sqlalchemy.engine...` (DB init)

**Agent output:** "Handling server start timeout"

### 2. Component Boundary Analysis

```
Layer 1: Start command returns
         └→ ( cd ... && python run.py > backend.log 2>&1 & ); echo "Backend started"
         └→ Bash exits quickly ✓

Layer 2: Server process
         └→ Uvicorn starts, DB init (5-15+ seconds)
         └→ Server IS running ✓

Layer 3: Agent verification (curl)
         └→ Agent runs verify_inbound_with_retry REMOTE_HOST:8000
         └→ First attempts: server still in "Waiting for application startup" / DB init
         └→ curl returns connection refused or 5xx → verification "fails"

Layer 4: Agent conclusion
         └→ Verification failed → agent infers "server start timeout"
         └→ INCORRECT: server did start, verification was too early or REMOTE_HOST wrong
```

### 3. Root Cause Hypothesis (Confirmed)

**The agent starts verification too soon.** FastAPI + Uvicorn + SQLAlchemy DB init typically needs 5–15 seconds. The verify script runs immediately after the start command returns. The first few curl attempts hit the server while it is still initializing (before "Application startup complete"), so they fail. The agent interprets repeated verification failures as "server start timeout" even though the server is running.

**Alternative:** REMOTE_HOST may be wrong (e.g. localhost when user is on overlay/remote), causing curl to fail regardless of server state.

### 4. Distinction

| Scenario | Server state | Agent conclusion | Correct conclusion |
|----------|--------------|------------------|--------------------|
| Actual timeout | Never started | "timeout" | ✓ Correct |
| Premature verify | Starting (DB init) | "timeout" | ✗ Should be "verification failed; retry" |
| Wrong REMOTE_HOST | Running | "timeout" | ✗ Should be "verification failed; check REMOTE_HOST" |

---

## Phase 2: Fix

### A. Add initial wait before verification

Insert an explicit wait (e.g. 8–10 seconds) before the first curl attempt, so the server can finish startup:

```bash
echo "Waiting 8s for server to finish startup (DB init, etc.)..."
sleep 8
verify_inbound_with_retry "backend" "$REMOTE_HOST" 8000
```

### B. Check logs before declaring timeout

If verification fails, check backend.log for success before concluding timeout:

```bash
if grep -q "Application startup complete\|Uvicorn running" backend.log 2>/dev/null; then
  echo "Server is running (per logs). Verification failed — check REMOTE_HOST/firewall."
  # Do NOT say "timeout"
else
  echo "Server may not have started. Check backend.log for errors."
fi
```

### C. Clarify "timeout" in the skill

Specify: do **not** say "server start timeout" when (1) the start command returned and (2) logs show the server running. Treat this as "verification failed (network/host)" instead.

---

## Phase 3: Implementation

- Update `skills/terminal-runner/SKILL.md`:
  - Add "Wait before first verification" step (sleep 8–10s)
  - Add guidance to check logs before declaring timeout
  - Clarify when to use "timeout" vs "verification failed"
