---
name: terminal-runner
description: 'Use this skill whenever the user wants to run terminal commands, execute scripts, render/run a page or project, start/stop processes, run build tools, test runners, compilers, linters, servers, or any shell-based task — including multi-service projects like frontend + backend. Triggers on: "run this", "execute", "start the server", "render the page", "run tests", "build", "start the app", or any request implying shell execution. MANDATORY: Execute every terminal command step via the Bash tool (never run_terminal_cmd or alternatives). Always use this skill so commands are planned, tracked, and properly terminated at end of conversation.'
---
# Terminal Runner Skill

Manages terminal command execution with cleanup, validation, phased startup, and guaranteed termination.

## Core Rules

1. **Bash tool only** — every shell command goes through the Bash tool, no exceptions
2. **nohup + disown for all servers** — `nohup bash -c '...' >> service.log 2>&1 & disown`
3. **Split install and run** — never combine in one bash call (2-min timeout risk)
4. **Clean ports before starting** — kill existing processes on target ports first
5. **Ask for workspace + remote_host** — never guess these

## Required Parameters

- **workspace**: Absolute path to the project (ask if not provided)
- **remote_host**: IP/hostname the user's browser uses to reach services (ask if not provided)

## Workflow

### Phase 0 — Clean Ports

```bash
nohup bash -c 'for port in 8000 3000; do lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null; done; echo "done"' >> cleanup.log 2>&1 &
disown; sleep 2; tail -5 cleanup.log
```

### Phase 1 — Validate

Check that directories exist, required files are present, and binaries are on PATH. Stop and report if anything is missing.

```bash
[ -d "$WORKSPACE" ] && echo "✓ workspace" || echo "✗ not found: $WORKSPACE"
[ -f "$WORKSPACE/backend/requirements.txt" ] && echo "✓ requirements.txt" || echo "✗ missing"
command -v uvicorn && echo "✓ uvicorn" || echo "✗ uvicorn not found"
```

### Phase 2 — Install (separate bash call per service)

```bash
# Backend
nohup bash -c 'cd /path/backend && source venv/bin/activate && pip install -q -r requirements.txt' >> backend_install.log 2>&1 &
disown; timeout 120 tail -f backend_install.log

# Frontend (separate call)
nohup bash -c 'cd /path/frontend && npm install --silent' >> frontend_install.log 2>&1 &
disown; timeout 120 tail -f frontend_install.log
```

**Python venv lookup order** (from service dir): `../.venv`, `../venv`, `../env`, `.venv`, `venv`, `env`

### Phase 3 — Start Services (separate bash call per service)

```bash
nohup bash -c 'cd /path/backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000' >> backend.log 2>&1 &
disown; echo "backend started"

nohup bash -c 'cd /path/frontend && npm run dev -- --host 0.0.0.0' >> frontend.log 2>&1 &
disown; echo "frontend started"
```

⚠️ If a command lacks `--host 0.0.0.0`, add it or warn the user.

### Phase 4 — Monitor Logs

```bash
sleep 3
timeout 8 tail -f backend.log
timeout 8 tail -f frontend.log
```

Look for success indicators (e.g., "Uvicorn running", "Ready in Xms"). If errors appear, stop and report.

### Phase 5 — Verify Reachability (up to 10 retries)

```bash
sleep 8  # wait for full startup
for i in $(seq 1 10); do
  code=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" "http://$REMOTE_HOST:8000")
  echo "$code" | grep -qE "^[23]" && echo "✓ reachable (attempt $i)" && break
  echo "attempt $i: HTTP $code, retrying..."
  sleep 2
done
```

If verification fails after all retries, check:
- Logs for "startup complete" (server running = firewall issue, not crash)
- Firewall rules (`ufw allow PORT`, AWS security groups, GCP ingress)
- Service bound to 0.0.0.0, not 127.0.0.1

## Output Format

```
PHASE 0: CLEAN PORTS         ✓ 8000 freed, 3000 freed
PHASE 1: VALIDATE            ✓ all checks passed
PHASE 2: INSTALL             ✓ backend deps, ✓ frontend deps
PHASE 3: START               ✓ backend (PID 1234), ✓ frontend (PID 5678)
PHASE 4: MONITOR             ✓ Uvicorn running, ✓ Next.js ready
PHASE 5: VERIFY              ✓ :8000 reachable, ✓ :3000 reachable

SERVICE    PORT   URL
backend    8000   http://<remote_host>:8000 ✓
frontend   3000   http://<remote_host>:3000 ✓

Type "terminate" to stop all services.
```

## Cleanup

On conversation end or "terminate":

```bash
nohup bash -c 'kill $(lsof -ti :8000) $(lsof -ti :3000) 2>/dev/null; echo "stopped"' >> cleanup.log 2>&1 &
disown; sleep 1; tail -3 cleanup.log
```

## Error Handling

| Problem | Action |
|---|---|
| Workspace not provided | Ask user |
| Binary not found | Report + suggest install command |
| Port cleanup fails | Report, suggest manual `kill $(lsof -ti :PORT)` |
| Log shows crash | Show tail of log, stop execution |
| Verify fails but log shows running | It's a firewall issue, not a crash — say so |
| Service binds to 127.0.0.1 | Add `--host 0.0.0.0` |