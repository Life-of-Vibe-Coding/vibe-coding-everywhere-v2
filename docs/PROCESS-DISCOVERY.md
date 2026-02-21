# Process Discovery: How Pi-Hosted Processes Are Found

This document describes how the Running Processes dashboard discovers and displays processes that were started by the Pi CLI agent.

## Overview

When you ask Pi to run a project (e.g. "run shophub" or "start the dev server"), it uses the **terminal-runner** skill to execute shell commands. Those commands typically start background servers with `nohup ... & disown`. The server has **no direct registry** of these processes—Pi does not report process start/stop events to the backend. Instead, we discover them by scanning ports.

## How Pi Hosts Processes

1. Pi receives a request (e.g. "run the backend and frontend").
2. Pi invokes the **Bash tool** with commands like:
   ```bash
   nohup bash -c 'cd backend && source venv/bin/activate && python run.py' >> backend.log 2>&1 &
   disown
   ```
3. The process runs detached (nohup + disown), so it survives beyond the Bash tool call.
4. Pi records PIDs in conversation context for cleanup, but **the server is not notified**.

Result: the server cannot know what processes Pi started unless we infer it from the system.

## Port-Based Discovery

We infer running processes by scanning **common development ports** for listeners.

### Algorithm

1. **Define ports to scan**  
   `server/utils/processes.js` scans: `3000, 3456, 4000, 5000, 5173, 8000, 8080, 3001, 4001` (typical Next.js, Vite, FastAPI, etc.).

2. **Find PIDs per port**  
   For each port, run:
   ```bash
   lsof -ti :<port>
   ```
   This returns PIDs of processes listening on that port.

3. **Get command line per PID**  
   For each PID, run:
   ```bash
   ps -p <pid> -o args=
   ```
   This returns the full command line (e.g. `node .next/standalone/server.js`, `uvicorn app.main:app`).

4. **Build the list**  
   Return `{ pid, port, command }` for each process.

### Platform Notes

- **macOS / Linux**: Uses `lsof` and `ps`. Works as described.
- **Windows**: Port scanning is skipped (returns empty list); different tooling would be needed.

## What Appears in the Dashboard

The dashboard shows two sources, merged and de-duplicated by PID:

| Source | How we get it | Example |
|--------|---------------|---------|
| **Run-render terminals** | Client state from Socket.IO (`run-render-started`, etc.) | PID 12345, command `npm run dev` |
| **Port-bound processes** | `GET /api/processes` (lsof + ps) | PID 12346, port 3000, command `node .next/...` |

If a run-render terminal is running a server on port 3000, the **parent** PID is shown in the terminal row. The **child** that actually binds the port may be a different PID; in that case both rows can appear. We de-duplicate only when the same PID appears in both sources.

## Limitations

1. **No semantic link to Pi**  
   We only know a process is listening on a port, not that Pi started it. Other tools (manually run servers, IDEs) will also appear.

2. **Command line may differ from Pi's command**  
   Pi might run `python run.py`, but the listening process could be `uvicorn app.main:app`. We show the actual process command line from `ps`.

3. **Port list is fixed**  
   Servers on non-standard ports (e.g. 4321) are not discovered unless added to the port list.

4. **No workspace filtering**  
   We do not filter by workspace path. Any process listening on the scanned ports on the host is included.

## Log file discovery and "View log"

Log paths are discovered in two ways:

### 1. lsof (stdout/stderr file descriptors) — primary for nohup

For processes started with `nohup ... >> file.log 2>&1`, the child process inherits the redirect. Its command line (from `ps`) does not contain the redirect, so we use `lsof -p <pid> -a -d 1,2` to see where fd 1 and 2 point:

```
lsof -p 87691 -a -d 1,2
COMMAND   PID    USER   FD   TYPE DEVICE SIZE/OFF      NODE NAME
node    87691 yifanxu    1w   REG  ...  /path/to/shophub/frontend.log
node    87691 yifanxu    2w   REG  ...  /path/to/shophub/frontend.log
```

We parse the `NAME` column for regular files (skip `/dev/null`, `/dev/tty`), convert to workspace-relative path, and add to `logPaths`.

### 2. Command parsing — fallback

When lsof yields nothing, `extractLogPathsFromCommand()` scans the command for `>> path` or `> path` where the path ends with `.log`, `.out`, or `.err`.

### View log flow

1. **API**: Each process may include `logPaths: string[]` (e.g. `["shophub/frontend.log"]` or `["backend.log"]`).
2. **Client**: When the user taps "Log", the client calls `GET /api/processes/log?path=...` (workspace-relative) or `?name=...` (filename only).
3. **Server**: Resolves the file, runs `tail -n 200`, and returns the content.

### API: GET /api/processes/log

- **Query params**: `name` (filename, e.g. `backend.log`) or `path` (workspace-relative path). Optional `lines` (default 200, max 500).
- **Response**: `{ content: string, path: string }` or `{ error: string }` on failure.

## API Reference

- **GET /api/processes**  
  Returns `{ processes: [{ pid, port, command, logPaths? }], warning?: string }`.  
  On discovery failure, returns 200 with `processes: []` and an optional `warning`.

- **GET /api/processes/log**  
  Returns last N lines of a log file. Query: `name` or `path`, optional `lines`.

- **POST /api/processes/:pid/kill**  
  Kills the process by PID. Body: none. Response: `{ ok: true }` or `{ ok: false, error }`.

## See Also

- [terminal-runner skill](../skills/terminal-runner/SKILL.md) – How Pi runs commands
- [AI-CLI-COMMANDS.md](./AI-CLI-COMMANDS.md) – Pi RPC integration
