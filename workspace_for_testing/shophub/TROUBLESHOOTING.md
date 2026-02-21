# ShopHub Troubleshooting Guide

## Problem: Services Getting Stuck When Using terminal-runner Skill

### Root Cause
The terminal-runner skill gets stuck because:

1. **Process accumulation**: Previous attempts leave orphaned processes running
2. **Port conflicts**: New instances can't bind to desired ports (8000, 3000)
3. **Background task blocking**: The skill waits for output but processes are already bound
4. **No cleanup mechanism**: Old processes aren't killed before starting new ones

### Current State (as of Feb 21, 2026)
```
Running processes:
- Python backend: PIDs 72381, 72384 on port 8002
- Next.js frontend: PID 30940 on port 3456
- Next.js frontend: PID 96936 on port 3001
- Multiple other Next.js instances
```

## Quick Fix Solutions

### Option 1: Use the Cleanup Scripts (Recommended)

```bash
# Stop all services
./stop-all.sh

# Clean up and restart
./cleanup-and-start.sh

# View logs
tail -f frontend.log
tail -f backend/backend.log
```

### Option 2: Manual Cleanup

```bash
# 1. Kill all ShopHub processes
pkill -f "next.*shophub"
pkill -f "python.*shophub"

# 2. Free up ports
lsof -ti :8000 | xargs kill -9
lsof -ti :3000 | xargs kill -9

# 3. Start backend
cd backend
source venv/bin/activate
python run.py &

# 4. Start frontend
cd ..
npm run dev -- --hostname 0.0.0.0 --port 3000 &
```

### Option 3: Direct Terminal Commands (No Skill)

Instead of using the terminal-runner skill, run directly in terminal:

**Terminal 1 - Backend:**
```bash
cd /Users/yifanxu/machine_learning/LoVC/vibe-coding-everywhere_v2/workspace_for_testing/shophub/backend
source venv/bin/activate
python run.py
```

**Terminal 2 - Frontend:**
```bash
cd /Users/yifanxu/machine_learning/LoVC/vibe-coding-everywhere_v2/workspace_for_testing/shophub
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Why terminal-runner Gets Stuck

### Issue 1: No Pre-Flight Cleanup
The skill doesn't check or kill existing processes before starting new ones.

**Fix needed in SKILL.md**: Add cleanup step before starting services:
```bash
# Before starting services, check and kill existing processes
cleanup_existing_processes() {
  local port=$1
  local pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "⚠️  Port $port occupied by PID $pid. Killing..."
    kill -9 $pid
  fi
}
```

### Issue 2: Port Fallback Not Working
The skill tries to use next available port (8000→8001→8002) but:
- Original process still holds the port
- Frontend doesn't know backend moved to different port
- No coordination between services

**Fix needed**: Always clean up ports first, don't fallback.

### Issue 3: Background Tasks Don't Return
When using `run_in_background: true`, the bash tool returns a task_id but:
- Process output isn't immediately available
- Verification checks run too early
- No retry mechanism if service isn't ready

**Fix needed**: Add retry logic to inbound verification:
```bash
verify_with_retry() {
  local max_attempts=10
  local attempt=1
  while [ $attempt -le $max_attempts ]; do
    if curl -s "http://$host:$port" >/dev/null 2>&1; then
      echo "✓ Service ready after $attempt attempts"
      return 0
    fi
    echo "Attempt $attempt/$max_attempts failed, waiting..."
    sleep 2
    attempt=$((attempt + 1))
  done
  return 1
}
```

## Best Practices for ShopHub

### 1. Always Clean First
```bash
./stop-all.sh
sleep 2
./cleanup-and-start.sh
```

### 2. Monitor Process Status
```bash
# Check what's running
ps aux | grep -E "(next|python)" | grep shophub

# Check port usage
lsof -i :8000
lsof -i :3000
```

### 3. Use Dedicated Terminals
Don't rely on background processes for development:
- Terminal 1: Backend (visible logs)
- Terminal 2: Frontend (visible logs)
- Easier to Ctrl+C when needed

### 4. Check Dependencies First
```bash
# Backend
cd backend
source venv/bin/activate
pip list | grep -E "(fastapi|uvicorn)"

# Frontend
npm list next react
```

## Recommended Changes to terminal-runner Skill

If you want to fix the skill itself, here are the key changes needed:

### 1. Add Pre-Flight Cleanup Phase
```markdown
### Step 1.5: Clean Existing Processes (Before Validation)

For each service port, check and kill existing processes:

\`\`\`bash
cleanup_ports() {
  local ports=("$@")
  for port in "${ports[@]}"; do
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
      echo "⚠️  Port $port occupied by PID $pid"
      echo "   Killing existing process..."
      kill -9 $pid
      sleep 1
    fi
  done
}

# Before starting services
cleanup_ports 8000 3000 5173
\`\`\`
```

### 2. Add Retry Logic to Verification
```markdown
verify_inbound() {
  local label="$1" host="$2" port="$3"
  local max_attempts=10
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    local code=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" "http://$host:$port" 2>/dev/null)
    if echo "$code" | grep -qE "^[23]"; then
      echo "✓ [$label] reachable at http://$host:$port (attempt $attempt)"
      return 0
    fi
    
    if [ $attempt -lt $max_attempts ]; then
      sleep 2
    fi
    attempt=$((attempt + 1))
  done
  
  echo "✗ [$label] NOT reachable after $max_attempts attempts"
  return 1
}
```

### 3. Add Task Output Monitoring
```markdown
After starting background tasks, actively monitor their output:

\`\`\`bash
# After starting with run_in_background
wait_for_task_output() {
  local task_id="$1"
  local search_pattern="$2"
  local timeout=30
  local elapsed=0
  
  while [ $elapsed -lt $timeout ]; do
    output=$(TaskOutput task_id="$task_id" block=false)
    if echo "$output" | grep -q "$search_pattern"; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

# Example: Wait for "Uvicorn running" in backend logs
wait_for_task_output "$backend_task_id" "Uvicorn running"
\`\`\`
```

## Environment-Specific Issues

### macOS-Specific
- PIDs can persist after terminal close
- Port cleanup requires `kill -9` (not just `kill`)
- `lsof` is reliable for port checking

### Network Configuration
- Backend binds to `0.0.0.0:8000` ✓ (correct)
- Frontend needs `--hostname 0.0.0.0` for remote access
- CORS already configured in backend for frontend origin

## Health Check Commands

```bash
# Quick status check
echo "Backend (should be port 8000):"
curl -s http://localhost:8000/api/health || echo "❌ Not responding"

echo "Frontend (should be port 3000):"
curl -s http://localhost:3000 | grep -q "ShopHub" && echo "✅ Running" || echo "❌ Not responding"

# Detailed process list
echo "ShopHub processes:"
ps aux | grep -E "(next|python)" | grep shophub | grep -v grep
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./stop-all.sh` | Kill all ShopHub processes |
| `./cleanup-and-start.sh` | Clean + start both services |
| `tail -f frontend.log` | View frontend logs |
| `tail -f backend/backend.log` | View backend logs |
| `lsof -i :8000` | Check backend port |
| `lsof -i :3000` | Check frontend port |
| `ps aux \| grep shophub` | List all processes |

## When All Else Fails

1. **Nuclear option** - Kill everything and restart:
```bash
pkill -9 -f shophub
sleep 2
cd /path/to/shophub
./cleanup-and-start.sh
```

2. **Verify clean slate**:
```bash
lsof -i :8000 && echo "❌ Port 8000 still occupied" || echo "✅ Port 8000 free"
lsof -i :3000 && echo "❌ Port 3000 still occupied" || echo "✅ Port 3000 free"
```

3. **Start fresh**:
```bash
# Backend
cd backend
source venv/bin/activate
python run.py

# Frontend (new terminal)
npm run dev
```
