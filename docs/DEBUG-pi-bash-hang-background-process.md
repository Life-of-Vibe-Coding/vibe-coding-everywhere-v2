# Systematic Debug: Pi Agent Hangs on Background Server Command

**Date:** 2026-02-22  
**Symptom:** Pi agent hangs at "Running command" when executing `cd ... && source venv/bin/activate && python run.py > backend.log 2>&1 & echo $!`. Socket connection is available.

---

## Phase 1: Root Cause Investigation

### 1. Evidence Gathered

**output.log** (`logs/llm-cli-input-output/.../output.log`):

| Event | call_BHT9TNcwKrK3x0xoAC0tRms9 (hanging bash) | Other bash (e.g. `ls`) |
|-------|----------------------------------------------|------------------------|
| tool_execution_start | ✓ (line 1164) | ✓ |
| tool_execution_update (partialResult) | ✓ "58949\n" (line 1165) | ✓ |
| tool_execution_end | **✗ MISSING** | ✓ |

**Command executed:**
```
cd /Users/yifanxu/.../shophub/backend && source venv/bin/activate && python run.py > backend.log 2>&1 & echo $!
```

**Observations:**
- Bash produced stdout (PID 58949) → partialResult was emitted
- Shell exited (echo $! ran)
- Pi never emitted `tool_execution_end` for this bash call

### 2. Component Boundary Analysis

```
Pi CLI → spawns bash subprocess → executes command
                ↓
        python run.py &  (background child of shell)
                ↓
        Shell exits after echo $!
                ↓
        Pi Bash tool: ???
                ↓
        tool_execution_end: NEVER EMITTED
```

### 3. Root Cause Hypothesis (Confirmed)

**Pi's Bash tool waits for the process group (or all child processes) to terminate before emitting `tool_execution_end`.**

Even though the shell process exited after `echo $!`, the background `python run.py` process remains a child of the process tree Pi tracks. Pi does not consider the tool "complete" until that process exits — which never happens for a long-running server.

### 4. Working vs. Broken Pattern

| Pattern | Result |
|---------|--------|
| `ls` | tool_execution_end in &lt;1s ✓ |
| `for port in ...; do kill ...; done` | tool_execution_end ✓ |
| `cd ... && python run.py > log 2>&1 & echo $!` | partialResult ✓, tool_execution_end ✗ |

---

## Phase 2: Fix — Subshell Isolation

**Solution:** Wrap the background start in a **subshell** so the long-running process is a child of the subshell, not the main shell. When the subshell exits, the background process is reparented to init. Pi's main shell exits quickly.

**Before (hangs):**
```bash
cd /path/backend && source venv/bin/activate && python run.py > backend.log 2>&1 & echo $!
```

**After (returns immediately):**
```bash
( cd /path/backend && source venv/bin/activate && python run.py > backend.log 2>&1 & )
echo "Backend started"
```

The subshell: (1) cd + activate + start python in background, (2) exits immediately. Python is reparented to init. Parent shell runs `echo` and exits. Pi sees full process tree exit → emits tool_execution_end.

**With PID capture (if needed):**
```bash
( cd /path/backend && source venv/bin/activate && python run.py > backend.log 2>&1 & echo $! > /tmp/backend.pid )
echo "Backend PID: $(cat /tmp/backend.pid)"
```

---

## Phase 3: Implementation

- Update `skills/terminal-runner/SKILL.md` FALLBACK to recommend subshell wrapper
- Update `server/process/piRpcSession.js` terminalRules to mention subshell pattern
