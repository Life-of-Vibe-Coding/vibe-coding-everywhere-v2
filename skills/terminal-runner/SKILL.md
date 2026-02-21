---
name: terminal-runner
description: 'Use this skill whenever the user wants to run terminal commands, execute scripts, render/run a page or project, start/stop processes, run build tools, test runners, compilers, linters, servers, or any shell-based task — including multi-service projects like frontend + backend. Triggers on: "run this", "execute", "start the server", "render the page", "run tests", "build", "start the app", or any request implying shell execution. Always use this skill so commands are planned, tracked, and properly terminated at end of conversation.'
---
# Terminal Runner Skill (Improved)

Manages terminal command execution with structured output, per-service command chains, inbound network verification, and guaranteed cleanup at conversation end.

## Quick Reference

1. **NEW: Clean existing processes on target ports before starting**
2. Require workspace + remote_host from user (never guess).
3. Validate workspace, binaries, and required files before running.
4. **CRITICAL: Split install and run into separate bash calls** to avoid timeout.
5. **CHANGED: Port occupied → kill the occupying process, then use the desired port**
6. Use `run_in_background: true` for server start commands; record task IDs for cleanup.
7. **NEW: Monitor background task output with retry logic**
8. Verify inbound HTTP reachability on remote_host with retry; wait 8s before first curl attempt (FastAPI/DB init needs time); do NOT conclude "timeout" if logs show server running.
9. On conversation end: stop all tracked background tasks.

## CRITICAL: Timeout Prevention

**Problem:** Bash tool calls have a 2-minute timeout. Running `pip install + npm install + server start` in one command can take 30-120+ seconds, causing timeout and session hang.

**Solution:** Split operations across multiple bash calls:

1. **Cleanup phase** — Kill existing processes on target ports:
   ```bash
   # Call 0: Clean ports (NEW)
   for port in 8000 3000 5173; do
     lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null
   done
   ```

2. **Install phase** — Run each install command separately (foreground):
   ```bash
   # Call 1: Backend install
   cd /path/backend && source venv/bin/activate && pip install -r requirements.txt

   # Call 2: Frontend install
   cd /path/frontend && npm install
   ```

3. **Run phase** — Start each server using `run_in_background: true`:
   ```bash
   # Call 3: Start backend (with run_in_background: true)
   cd /path/backend && source venv/bin/activate && python run.py

   # Call 4: Start frontend (with run_in_background: true)
   cd /path/frontend && npm run dev -- --host 0.0.0.0
   ```

4. **Monitor phase** — Check background task output and verify reachability

**Rules:**
- Each bash call should complete in under 60 seconds
- Never combine `pip install` + `npm install` + server start in one command
- Use `run_in_background: true` for any long-running server process
- **FALLBACK:** If the Bash tool does not honor `run_in_background` and the call hangs, use a **subshell** to isolate the background process so Pi's Bash tool returns immediately: `( cd backend && source venv/bin/activate && python run.py > backend.log 2>&1 & )` then `echo "Backend started"`. The subshell exits right after backgrounding; the server is reparented to init, so Pi does not wait for it.
- Check background task output using `TaskOutput` tool with the returned task_id (when available)
- **NEW: Always clean ports before starting services**

## Parameters

REQUIRED parameters (ask for both if either is missing; never guess or auto-detect):

- workspace: Absolute path on the user's local filesystem. Must be provided explicitly.
- remote_host: IP or hostname the user's browser uses to access exposed services (e.g. 1.2.3.4 or myserver.example.com). Used for inbound verification. Never derive from ipify.org or hostname.

## Core Principles

1. **NEW: Clean before start**: Always kill processes on target ports before starting new services.
2. Workspace is a user parameter: validate it exists, then cd into it. Never guess.
3. Validate before running: check every binary and required file. On failure, report exact reason and stop.
4. **Split install and run**: Never combine install + run in one bash call. Execute in phases to avoid timeout.
5. Python projects: look for venv from project root or service dir (.venv, venv, env) and activate it.
6. **CHANGED: Port already in use → kill it, then use the desired port** (prevents port drift).
7. Inbound verification with retry: verify HTTP services are reachable from user's browser (up to 10 attempts).
8. Track background tasks: every server gets started with `run_in_background: true`; record task_ids for cleanup.
9. **NEW: Monitor task output**: Use TaskOutput to check if services started successfully.
10. Stop all on conversation end: use TaskStop for every tracked task_id when done.

## Workflow

### Step 0: Identify Target Ports and Clean (NEW)

Before any validation or execution, identify all ports the services will need and clean them.

```bash
cleanup_ports() {
  local ports=("$@")
  echo "🧹 Cleaning existing processes on target ports..."
  
  for port in "${ports[@]}"; do
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "  Port $port occupied by PID(s): $pids"
      echo "  Killing..."
      echo "$pids" | xargs kill -9 2>/dev/null
      sleep 1
      
      # Verify cleanup
      if lsof -ti :$port &>/dev/null; then
        echo "  ⚠️  Port $port still occupied after cleanup"
      else
        echo "  ✓ Port $port freed"
      fi
    else
      echo "  ✓ Port $port already free"
    fi
  done
  
  echo ""
}

# Example for Python backend (8000) + Next.js frontend (3000)
cleanup_ports 8000 3000
```

**When to run cleanup:**
- Before Phase 1 (Install) — ensures no conflicts when starting services later
- Run as a separate bash call to avoid timeout
- Always report which ports were cleaned and which failed

**Port Identification:**
Scan the planned run commands for port numbers:
- Backend: Look for `--port 8000`, `:8000`, `PORT=8000`, etc.
- Frontend: Common defaults are 3000 (Next.js), 5173 (Vite), 8080 (generic)
- If no explicit port: use framework defaults

### Step 1: Set and Validate Workspace

```bash
WORKSPACE="/path/the/user/provided"

if [ ! -d "$WORKSPACE" ]; then
  echo "ERROR: Workspace does not exist: $WORKSPACE"
  exit 1
fi

cd "$WORKSPACE"
echo "Workspace: $WORKSPACE"
```

If workspace not specified: stop and ask "What is the path to your project directory on your local machine?"

### Step 2: Identify Services and Plan Commands

Analyse the user's request. Group everything into **services** — one per independently running concern (frontend, backend, worker, database, etc.).

For each service, identify:
1. **Target port**: Default or specified port number
2. **Install command**: `pip install -r requirements.txt` or `npm install`
3. **Run command**: `python run.py` or `npm run dev`
4. **Working directory**: where to cd before running

**NOTE:** These are planned separately — do NOT run them as one chain. See Step 4 for the actual phased execution pattern that avoids timeout.

#### Python: Look for venv from project root

For Python services, look for a virtual environment in this order (relative to the service's working directory):

1. `../.venv` — venv at project root when service is in a subdir (e.g. backend/)
2. `../venv` — alternative name at project root
3. `../env` — alternative name at project root
4. `.venv` — venv in the service dir itself
5. `venv` or `env` — in the service dir

Include venv activation in both install and run commands.

**Service Planning Examples** (these define WHAT to run, not HOW — see Step 4 for phased execution):

Single frontend app:
- Port: 3000
- Install: `cd /home/alice/myproject && npm install`
- Run: `cd /home/alice/myproject && npm run dev -- --host 0.0.0.0`

Python backend + React frontend:
- Backend port: 8000
- Backend install: `cd /home/alice/myproject/backend && source venv/bin/activate && pip install -r requirements.txt`
- Backend run: `cd /home/alice/myproject/backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000`
- Frontend port: 3000
- Frontend install: `cd /home/alice/myproject/frontend && npm install`
- Frontend run: `cd /home/alice/myproject/frontend && npm run dev -- --host 0.0.0.0`

Monorepo with worker:
- Install: `cd /home/alice/myproject && pnpm install` (once for all)
- API port: 4000
- API run: `cd /home/alice/myproject && pnpm run --filter api dev`
- Web port: 3000
- Web run: `cd /home/alice/myproject && pnpm run --filter web dev`
- Worker: no port
- Worker run: `cd /home/alice/myproject && pnpm run --filter worker start`

### Step 3: Validate Each Command in Every Chain

Before presenting the plan, check that every executable in every chain can actually run on the system. If anything fails validation, tell the user the exact reason and **do not proceed** until it is resolved.

#### What to check per command

For each binary (the first token of each `&&`-separated command):

```bash
validate_command() {
  local cmd="$1"

  # 1. Is the binary available on PATH?
  if ! command -v "$cmd" &>/dev/null; then
    echo "✗ '$cmd' not found — not installed or not on PATH"
    suggest_install "$cmd"
    return 1
  fi

  # 2. Is it executable?
  local bin_path
  bin_path=$(command -v "$cmd")
  if [ ! -x "$bin_path" ]; then
    echo "✗ '$cmd' exists at $bin_path but is not executable"
    echo "  Fix: chmod +x $bin_path"
    return 1
  fi

  echo "✓ '$cmd' found at $bin_path"
  return 0
}
```

#### Also check the working directory of each chain

```bash
validate_cwd() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    echo "✗ Directory does not exist: $dir"
    return 1
  fi
  echo "✓ Directory exists: $dir"
}
```

#### Check required files exist

If a command references a specific file (e.g. `pip install -r requirements.txt`, `node index.js`), verify it exists in the expected location:

```bash
if [ ! -f "$WORKSPACE/backend/requirements.txt" ]; then
  echo "✗ requirements.txt not found in backend/ — 'pip install -r requirements.txt' will fail"
fi
```

#### Common install suggestions

```bash
suggest_install() {
  case "$1" in
    node|npm)   echo "  Install: https://nodejs.org or 'nvm install --lts'" ;;
    npx)        echo "  Install: comes with npm — run 'npm install -g npm'" ;;
    pnpm)       echo "  Install: npm install -g pnpm" ;;
    yarn)       echo "  Install: npm install -g yarn" ;;
    python|python3) echo "  Install: https://python.org or 'apt install python3'" ;;
    pip|pip3)   echo "  Install: comes with Python — or 'apt install python3-pip'" ;;
    uvicorn)    echo "  Install: pip install uvicorn" ;;
    cargo)      echo "  Install: https://rustup.rs" ;;
    go)         echo "  Install: https://go.dev/dl" ;;
    docker)     echo "  Install: https://docs.docker.com/get-docker" ;;
    docker-compose) echo "  Install: https://docs.docker.com/compose/install" ;;
    make)       echo "  Install: apt install make  OR  brew install make" ;;
    *)          echo "  Check your package manager or project README for install instructions" ;;
  esac
}
```

#### Validation output format

Present a validation report before the plan:

```
PRE-RUN VALIDATION
---
  backend/
    ✓ Directory exists
    ✓ requirements.txt found
    ✓ pip found at /usr/bin/pip3
    ✓ uvicorn found at /usr/local/bin/uvicorn

  frontend/
    ✓ Directory exists
    ✗ npm not found — not installed or not on PATH
        Install: https://nodejs.org or 'nvm install --lts'
---
1 issue found. Resolve before proceeding.
```

If all checks pass: proceed to execute. If any issue found: stop and wait for user to fix.

### Step 4: Execute in Phases (Timeout-Safe)

**CRITICAL:** Never run install + start in one bash call. Split into phases to avoid timeout.

#### Phase 0: Cleanup Existing Processes (NEW)

Before installing or starting anything, clean the target ports.

```bash
# Bash call 0: Clean ports
for port in 8000 3000; do
  lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null
  sleep 0.5
done
echo "✓ Ports cleaned"
```

Report cleanup results:
```
PHASE 0: CLEANING PORTS
---
  Port 8000: ✓ freed (was occupied by PID 12345)
  Port 3000: ✓ freed (was occupied by PID 67890)
```

#### Phase 1: Install Dependencies (Foreground)

Run each install command as a **separate bash call**. Wait for each to complete before proceeding.

```bash
# Bash call 1: Backend dependencies
cd /home/alice/myproject/backend && source venv/bin/activate 2>/dev/null && pip install -q -r requirements.txt
# Wait for completion, then make next call

# Bash call 2: Frontend dependencies
cd /home/alice/myproject/frontend && npm install --silent
# Wait for completion, then proceed to Phase 2
```

#### Phase 2: Start Services (Background)

Start each server using the Bash tool with `run_in_background: true`. This returns immediately with a task_id.

**FALLBACK:** If the Bash tool ignores `run_in_background` and the call hangs, use a **subshell** so Pi returns immediately. Pi waits for all child processes; wrapping in `( ... & )` detaches the server from Pi's process tree:

```bash
# Bash call 3: Start backend (use run_in_background: true)
# FALLBACK if it hangs: use subshell — ( cmd & ) then echo done
( cd /home/alice/myproject/backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 & )
echo "Backend started"

# Bash call 4: Start frontend
( cd /home/alice/myproject/frontend && npm run dev -- --host 0.0.0.0 > frontend.log 2>&1 & )
echo "Frontend started"
```

```bash
# Primary (when run_in_background works):
cd /home/alice/myproject/backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Returns task_id immediately

# FALLBACK (when Pi hangs waiting for background process):
( cd ... && source venv/bin/activate && uvicorn ... > backend.log 2>&1 & )
echo "Backend started"
```

#### Phase 3: Monitor Task Output (NEW)

After starting services, monitor their output to ensure they started successfully.

Use `TaskOutput` with `block: false` to check each background task:

```bash
# Check backend task output
TaskOutput(task_id: "bg_abc123", block: false)

# Look for success indicators like:
# - "Uvicorn running on http://0.0.0.0:8000"
# - "Application startup complete"
# - No error messages
```

Wait 3-5 seconds after starting before checking output, then report:

```
PHASE 3: MONITORING SERVICES
---
  backend (bg_abc123):
    ✓ Uvicorn running on http://0.0.0.0:8000
    ✓ Application startup complete
  
  frontend (bg_def456):
    ✓ Next.js started
    ✓ Ready in 1234ms
```

If errors detected in output, report them immediately and stop.

#### Phase 4: Verify Inbound Reachability with Retry (IMPROVED)

After confirming services started, verify they're reachable with retry logic.

**Task ID Tracking:**
- Store returned task_ids for later cleanup
- Use `TaskOutput` tool to read server logs
- Use `TaskStop` tool to terminate services at conversation end

### Step 5: Inbound Verification with Retry (IMPROVED)

For every service that exposes a port, verify the user's browser can reach it after startup with retry mechanism.

**CRITICAL: Wait before first verification.** FastAPI/Uvicorn + DB init typically needs 8–15 seconds. If you verify immediately after the start command returns, curl will fail while the server is still initializing. **Do NOT conclude "server start timeout"** — the server may be running; verification was too early. Add an initial wait:

```bash
echo "Waiting 8s for backend to finish startup (DB init, etc.)..."
sleep 8
```

The question is: **can the user's browser reach this port on `REMOTE_HOST`?**

`REMOTE_HOST` is the value the user provided — never derived or guessed.

```bash
verify_inbound_with_retry() {
  local label="$1" host="$2" port="$3"
  local max_attempts=10
  local attempt=1
  
  echo "Verifying $label at http://$host:$port..."
  
  while [ $attempt -le $max_attempts ]; do
    local code
    code=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" "http://$host:$port" 2>/dev/null)
    
    if echo "$code" | grep -qE "^[23]"; then
      echo "✓ [$label] reachable at http://$host:$port (attempt $attempt)"
      return 0
    fi
    
    if [ $attempt -lt $max_attempts ]; then
      echo "  Attempt $attempt/$max_attempts: HTTP $code, retrying in 2s..."
      sleep 2
    fi
    
    attempt=$((attempt + 1))
  done
  
  echo "✗ [$label] NOT reachable at http://$host:$port after $max_attempts attempts"
  echo ""
  echo "  Last HTTP code: $code"
  echo ""
  echo "  Before concluding 'timeout': check backend.log (or frontend.log) for 'Application startup complete' or 'Uvicorn running'. If present, the server started — the failure is verification (REMOTE_HOST, firewall), NOT timeout."
  echo ""
  echo "  Possible causes:"
  echo "  • Service still starting up (check logs)"
  echo "  • Firewall/security group blocking port $port"
  echo "  • Service bound to 127.0.0.1 instead of 0.0.0.0"
  echo "  • Project whitelisting: IP/origin allowlist may exclude remote_host"
  echo "  • CORS: backend may block requests from remote_host origin"
  echo ""
  echo "  To fix — verify service is running, then check firewall rules:"
  echo "    Local:        sudo ufw allow $port"
  echo "    AWS EC2:      EC2 → Security Groups → Inbound Rules → Custom TCP → $port"
  echo "    GCP:          VPC Network → Firewall → Create rule → Ingress → tcp:$port"
  
  return 1
}

# REMOTE_HOST is the value provided by the user
# IMPORTANT: Wait 8s before first attempt — FastAPI + DB init needs time
sleep 8
verify_inbound_with_retry "backend"  "$REMOTE_HOST" 8000
verify_inbound_with_retry "frontend" "$REMOTE_HOST" 3000
```

**Key improvements:**
- Up to 10 retry attempts (30 seconds total)
- Reports attempt number and HTTP code
- Only fails if all retries exhausted
- Gives service time to fully start

⚠️ If a service command does **not** include `--host 0.0.0.0` (or equivalent), warn the user before starting:

WARNING: If service command lacks --host 0.0.0.0, warn user and add it: "This service will bind to localhost only. Adding --host 0.0.0.0."

### Step 6: Emit Structured Output

Emit one result block per service after it starts, followed by an overall summary.

#### Example — Two services (frontend + backend) with all phases

A Python API and a Next.js frontend running as separate services.

```
PHASE 0: CLEANING PORTS
---
  Port 8000: ✓ freed (was occupied by PID 12345)
  Port 3000: ✓ freed (was occupied by PID 67890)

PRE-RUN VALIDATION
---
  /home/alice/myapp/backend
    ✓ Directory exists
    ✓ requirements.txt found
    ✓ pip       →  /usr/bin/pip3
    ✓ uvicorn   →  /usr/local/bin/uvicorn

  /home/alice/myapp/frontend
    ✓ Directory exists
    ✓ package.json found
    ✓ npm       →  /usr/bin/npm
---
All commands validated ✓

PHASE 1: INSTALLING DEPENDENCIES
---
[Bash call 1] cd /home/alice/myapp/backend && source venv/bin/activate && pip install -q -r requirements.txt
  ✓ Backend dependencies installed

[Bash call 2] cd /home/alice/myapp/frontend && npm install --silent
  ✓ Frontend dependencies installed

PHASE 2: STARTING SERVICES (background)
---
[Bash call 3, run_in_background: true] cd /home/alice/myapp/backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ✓ Backend started (task_id: bg_abc123)

[Bash call 4, run_in_background: true] cd /home/alice/myapp/frontend && npm run dev -- --host 0.0.0.0
  ✓ Frontend started (task_id: bg_def456)

PHASE 3: MONITORING TASK OUTPUT
---
  backend (bg_abc123):
    ✓ Uvicorn running on http://0.0.0.0:8000
    ✓ Application startup complete
  
  frontend (bg_def456):
    ✓ Next.js 14.2.35
    ✓ Local: http://localhost:3000
    ✓ Ready in 1176ms

PHASE 4: VERIFICATION (with retry)
---
  backend:  ✓ reachable at http://<remote_host>:8000 (attempt 2)
  frontend: ✓ reachable at http://<remote_host>:3000 (attempt 1)

ALL SERVICES RUNNING
---
  SERVICE     TASK_ID      STATUS    ACCESS URL
  backend     bg_abc123    running   http://<remote_host>:8000  ✓
  frontend    bg_def456    running   http://<remote_host>:3000  ✓
---
Type "terminate" to stop all services.
```

## Cleanup Protocol

### Track running services

Keep a list of background task_ids during the session:
- `backend: bg_abc123`
- `frontend: bg_def456`

### Check service status

Use `TaskOutput` tool with `block: false` to check if a service is still running and see its recent output.

### Stop a single service

Use `TaskStop` tool with the task_id:
```
TaskStop(task_id: "bg_abc123")
```

### End of conversation / "terminate" / "stop all"

Stop all tracked background tasks using `TaskStop` for each task_id:

```
# For each tracked service:
TaskStop(task_id: "bg_abc123")  # backend
TaskStop(task_id: "bg_def456")  # frontend
```

Report each termination:
```
SERVICES TERMINATED
---
  backend  (bg_abc123): stopped ✓
  frontend (bg_def456): stopped ✓
---
All services terminated.
```

RULE: Always stop all background tasks at conversation end.

## Error Handling

- Workspace not provided: Stop and ask the user.
- Workspace path does not exist: Report exact path, ask user to correct.
- Binary not found on PATH: Report which command, suggest how to install.
- Binary exists but not executable: Report path, suggest chmod +x.
- Required file missing (e.g. requirements.txt): Report which file and which command needs it.
- Command fails mid-chain (&& stops it): Report which command failed and its output.
- **NEW: Port cleanup fails**: Report which port couldn't be freed, suggest manual cleanup.
- **NEW: Background task output shows errors**: Stop execution, show error output, ask user to fix.
- Service crashes after start: Report in summary, show crash logs from TaskOutput.
- Inbound check fails after retries: Show which attempts failed and final error state. **Do NOT say "server start timeout"** if logs (backend.log, frontend.log) show the server running ("Application startup complete", "Uvicorn running"). That is "verification failed" (REMOTE_HOST/firewall), not timeout.
- Service binds to 127.0.0.1: Warn before starting, add --host 0.0.0.0 to chain.
- **CHANGED: Port already in use after cleanup**: Report failure, suggest manual intervention.
- Permission denied: Suggest chmod +x or sudo.

## Key Improvements Summary

### 1. **Pre-Flight Cleanup** (NEW)
- Always kill processes on target ports before starting
- Prevents port conflicts and "stuck" processes
- Ensures clean slate for each run

### 2. **Task Output Monitoring** (NEW)
- Check background task output after starting
- Detect startup errors immediately
- Confirm services actually running

### 3. **Retry Logic for Verification** (IMPROVED)
- Up to 10 attempts with 2-second delays
- Gives services time to fully start
- Reports progress on each attempt
- Only fails after all retries exhausted

### 4. **Port Management** (CHANGED)
- Kill existing processes instead of finding alternative ports
- Prevents port drift (8000→8001→8002)
- Maintains service coordination
- Clearer error messages

### 5. **Better Error Reporting**
- Show exact reasons for failures
- Suggest specific fixes
- Display task output when errors occur
- Track which phase failed
