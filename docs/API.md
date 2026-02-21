# API Documentation

Complete reference for REST API endpoints and Socket.IO events.

## REST API

### GET /api/config

Returns server configuration.

**Response:**

```json
{
  "sidebarRefreshIntervalMs": 3000
}
```

### GET /api/workspace-path

Returns the current workspace directory.

**Response:**

```json
{
  "path": "/Users/name/projects/my-project"
}
```

### GET /api/workspace-tree

Returns the file tree of the workspace.

**Response:**

```json
{
  "root": "my-project",
  "tree": [
    {
      "name": "src",
      "path": "src",
      "type": "folder",
      "children": [
        { "name": "index.js", "path": "src/index.js", "type": "file" }
      ]
    },
    { "name": "package.json", "path": "package.json", "type": "file" }
  ]
}
```

### GET /api/workspace-file

Returns the content of a workspace file.

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Relative path to file |

**Response (text file):**

```json
{
  "path": "src/index.js",
  "content": "console.log('hello');"
}
```

**Response (image):**

```json
{
  "path": "assets/logo.png",
  "content": "base64encoded...",
  "isImage": true
}
```

**Error Responses:**

- `400` - Missing or invalid path
- `403` - Path outside workspace
- `404` - File not found
- `413` - File too large (>512KB)

### GET /api/preview-raw

Serves a file raw for preview (HTML, CSS, JS).

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Relative path to file |

**Response:** File content with appropriate Content-Type header.

**Error Responses:**

- `400` - Missing or invalid path
- `403` - Path outside workspace
- `404` - File not found

---

## Socket.IO Events

### Client → Server

#### `submit-prompt`

Start a new AI session (Claude, Gemini, or Codex) with a prompt.

**Payload:**

```typescript
{
  prompt: string;           // The prompt to send
  provider?: "claude" | "gemini" | "codex";  // Optional: default from DEFAULT_PROVIDER
  model?: string;          // Optional: Claude (haiku, sonnet, opus), Gemini (e.g. gemini-2.5-flash), or Codex (e.g. gpt-5-codex); default by provider
  permissionMode?: string;  // Optional: Claude permission mode (default from env)
  allowedTools?: string[];  // Optional: allowed tool patterns (Claude)
  approvalMode?: string;    // Optional: Gemini approval mode (default, auto_edit, plan)
  askForApproval?: string;  // Optional: Codex --ask-for-approval (e.g. untrusted, on-request)
  fullAuto?: boolean;      // Optional: Codex --full-auto
  yolo?: boolean;          // Optional: Codex --yolo
  replaceRunning?: boolean; // Optional: kill existing session first
}
```

**Codex continuation:** For subsequent turns in the same session, the server reuses the same `thread_id` from `thread.started` and calls `turn/start` on Codex app-server.

**Example:**

```javascript
socket.emit("submit-prompt", {
  prompt: "Create a React component",
  provider: "gemini",
  approvalMode: "auto_edit"
});

socket.emit("submit-prompt", {
  prompt: "Refactor this file",
  provider: "claude",
  permissionMode: "acceptEdits",
  allowedTools: ["Read", "Write"]
});
```

#### `input`

Send input to Claude (for permission prompts or tool inputs).

**Payload:** `string` - The input text

**Example:**

```javascript
socket.emit("input", "yes\n");
```

#### `resize`

Resize the PTY terminal.

**Payload:**

```typescript
{
  cols: number;
  rows: number;
}
```

#### `claude-terminate`

Kill the running Claude process.

**Payload (optional):**

```typescript
{
  resetSession?: boolean; // true to force next submit to start fresh (no -c/--continue)
}
```

#### `claude-debug`

Send debug information to server logs.

**Payload:** Any object

#### `run-render-command`

Execute a command in a new terminal.

**Payload:**

```typescript
{
  command: string;  // Shell command to execute
  url?: string;     // Optional: associated preview URL
}
```

**Example:**

```javascript
socket.emit("run-render-command", {
  command: "npm run dev",
  url: "http://localhost:3000"
});
```

#### `run-render-new-terminal`

Create a new interactive terminal.

**Payload:** None

#### `run-render-write`

Write data to a terminal's stdin.

**Payload:**

```typescript
{
  terminalId: string;
  data: string;
}
```

#### `run-render-terminate`

Kill a terminal process.

**Payload:**

```typescript
{
  terminalId: string;
}
```

---

### Server → Client

#### `connect` / `disconnect`

Standard Socket.IO connection events.

#### `output`

Raw output from Claude (JSON lines format).

**Payload:** `string` - JSON line from Claude CLI

**Example:**

```json
{"type": "assistant", "message": {"content": [{"type": "text", "text": "Hello!"}]}}
```

#### `claude-started`

Emitted when AI CLI process starts.

**Payload:**

```typescript
{
  provider: "claude" | "gemini";
  permissionMode: string | null;   // Claude only
  allowedTools: string[];
  useContinue: boolean;            // Claude only
  approvalMode: string | null;     // Gemini only
}
```

#### `exit`

Emitted when Claude process exits.

**Payload:**

```typescript
{
  exitCode: number;
}
```

#### `run-render-started`

Emitted when a new terminal is created.

**Payload:**

```typescript
{
  terminalId: string;
  pid: number | null;
}
```

#### `run-render-result`

Result of running a command.

**Payload:**

```typescript
{
  ok: boolean;
  url?: string;
  terminalId?: string;
  error?: string;
}
```

#### `run-render-stdout`

Terminal stdout data.

**Payload:**

```typescript
{
  terminalId: string;
  chunk: string;
}
```

#### `run-render-stderr`

Terminal stderr data.

**Payload:**

```typescript
{
  terminalId: string;
  chunk: string;
}
```

#### `run-render-exit`

Terminal process exited.

**Payload:**

```typescript
{
  terminalId: string;
  code: number | null;
  signal: string | null;
}
```

---

## AI Stream Format

Claude and Gemini both output JSON lines. Common event types:

### `system`

```json
{
  "type": "system",
  "model": "claude-sonnet-4",
  "session_id": "sess_123",
  "cwd": "/workspace"
}
```

### `assistant`

```json
{
  "type": "assistant",
  "message": {
    "content": [
      {"type": "text", "text": "I'll help you..."},
      {"type": "tool_use", "name": "Read", "input": {"file_path": "src/index.js"}}
    ]
  }
}
```

### `permission_denials`

```json
{
  "permission_denials": [
    {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}
  ]
}
```

### `AskUserQuestion` (tool call)

```json
{
  "tool_name": "AskUserQuestion",
  "tool_use_id": "toolu_123",
  "tool_input": {
    "questions": [
      {
        "header": "Purpose",
        "question": "What should this do?",
        "options": [{"label": "Option A"}, {"label": "Option B"}],
        "multiSelect": false
      }
    ]
  }
}
```

---

## Error Handling

### REST Errors

All errors include an `error` field:

```json
{
  "error": "File not found"
}
```

### Socket Errors

Server emits errors via `output` event with ANSI red color:

```
\r\n\x1b[31m[Error] claude not found\x1b[0m\r\n
\r\n\x1b[31m[Error] gemini not found\x1b[0m\r\n
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| `ENOENT` | File or command not found |
| `EACCES` | Permission denied |
| `413` | File too large |
