# Architecture Guide

This document describes the system architecture, design patterns, and component relationships.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
├─────────────────────┬─────────────────────┬─────────────────────┤
│   Web Browser       │   iOS Device        │   Android Device    │
│                     │                     │                     │
│   - HTML/JS         │   - Expo/React      │   - Expo/React      │
│   - Socket.IO       │   - Socket.IO       │   - Socket.IO       │
└─────────┬───────────┴──────────┬──────────┴──────────┬──────────┘
          │                      │                     │
          └──────────────────────┼─────────────────────┘
                                 │ Socket.IO
                    ┌────────────▼────────────┐
                    │      SERVER             │
                    │  ┌─────────────────┐    │
                    │  │  Express HTTP   │    │
                    │  │  - Static files │    │
                    │  │  - REST API     │    │
                    │  └────────┬────────┘    │
                    │           │             │
                    │  ┌────────▼────────┐    │
                    │  │   Socket.IO     │◄───┼── Real-time events
                    │  │   - Connection  │    │
                    │  │   - Events      │    │
                    │  └────────┬────────┘    │
                    │           │             │
                    │  ┌────────▼────────┐    │
                    │  │   Pi RPC        │    │
                    │  │   pi --mode rpc │    │
                    │  └────────┬────────┘    │
                    └───────────┼─────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Pi (pi-mono)        │
                    │   Claude / Gemini /   │
                    │   Codex               │
                    │   - Local execution   │
                    │   - File operations   │
                    │   - Tool use          │
                    └───────────────────────┘
```

## Server Architecture

### Module Organization

```
server.js (entry point)
    │
    ├──► config/      # Environment & configuration
    ├──► routes/      # HTTP request handlers
    ├──► socket/      # WebSocket event handlers
    ├──► process/     # AI provider management (Pi RPC)
    └──► utils/       # Shared utilities
```

### Request Flow

```
HTTP Request          Socket Event
     │                    │
     ▼                    ▼
┌─────────┐         ┌───────────┐
│ Express │         │ Socket.IO │
│ Routes  │         │ Handlers  │
└────┬────┘         └─────┬─────┘
     │                    │
     └────────┬───────────┘
              │
       ┌──────▼──────┐
       │  Services   │
       │ - File I/O  │
       │ - Process   │
       │ - Prompts   │
       └──────┬──────┘
              │
       ┌──────▼──────┐
       │ Pi RPC      │
       │ Claude/     │
       │ Gemini/Codex│
       └─────────────┘
```

### Key Components

#### Config (`server/config/`)

- Resolves workspace directory from CLI args or environment
- Sets up logging paths
- Defines constants (PORT, refresh intervals, etc.)

#### Routes (`server/routes/`)

| Route | Purpose |
|-------|---------|
| `/api/config` | Server configuration for clients |
| `/api/workspace-path` | Absolute path to current workspace |
| `/api/workspace-tree` | File tree for sidebar |
| `/api/workspace-file` | File content with size limits |
| `/api/preview-raw` | Raw file serving for previews |
| `*` | Static file serving |

#### Socket (`server/socket/`)

Two main managers:

1. **ProcessManager** (AI provider): Handles Pi RPC lifecycle for Claude/Gemini/Codex
2. **RunRenderManager**: Manages terminal processes for commands

#### Process (`server/process/`)

- `piRpcSession.js` spawns `pi --mode rpc` with provider (anthropic/openai/google) and model
- `createProcessManager()` wires Pi RPC to socket events
- Manages process lifecycle and cleanup on shutdown

### Data Flow: AI Session (Pi RPC)

```
1. Client emits "submit-prompt" (with optional provider)
          │
          ▼
2. Server spawns Pi (`pi --mode rpc --provider ... --model ...`)
   - Sets up logging (llm-cli-input-output)
          │
          ▼
3. CLI starts, emits "claude-started" (payload includes provider)
          │
          ▼
4. Output streams via "output" events
   (JSON lines from CLI)
          │
          ▼
5. Session ends, emits "exit"
```

## Mobile App Architecture

### Layer Structure

```
┌─────────────────────────────────────┐
│  UI Layer (Components)              │
│  - MessageBubble                    │
│  - InputPanel                       │
│  - WorkspaceSidebar                 │
│  - etc.                             │
├─────────────────────────────────────┤
│  Hook Layer                         │
│  - useSse (main state)             │
│  - Custom hooks                     │
├─────────────────────────────────────┤
│  Service Layer                      │
│  - Socket management                │
│  - AI provider event strategies     │
│  - File operations                  │
│  - Server config                    │
├─────────────────────────────────────┤
│  Domain Layer (Core)                │
│  - Types & interfaces               │
│  - Pure functions                   │
└─────────────────────────────────────┘
```

### Component Organization

Components are grouped by feature:

```
components/
├── chat/          # Chat-related UI
├── file/          # File management UI
├── preview/       # Preview/render UI
└── common/        # Shared components
```

### State Management

Single source of truth in `useSse` hook:

```typescript
// Key state pieces
const [messages, setMessages] = useState<Message[]>([]);
const [agentRunning, setAgentRunning] = useState(false);
const [terminals, setTerminals] = useState<TerminalState[]>([]);
const [pendingRender, setPendingRender] = useState<PendingRender | null>(null);
```

### Event Handling Strategy

AI provider events (Claude, Gemini) are handled via a strategy pattern:

```typescript
// Each event type has a handler
const handlers = new Map<string, Handler>([
  ["system", handleSystem],
  ["assistant", handleAssistant],
  ["input", handleInput],
  // ...
]);

// Dispatcher looks up and calls handler
const handler = handlers.get(eventType);
if (handler) handler(data, context);
```

This allows adding new event types without modifying the dispatcher.

### Dependency Injection

Key interfaces for testability:

```typescript
// Server configuration
interface IServerConfig {
  getBaseUrl(): string;
  resolvePreviewUrl(url: string): string;
}

// File operations
interface IWorkspaceFileService {
  fetchFile(path: string): Promise<{ content: string; isImage: boolean }>;
}
```

Implementations are injected via props or context.

## Design Patterns

### 1. Strategy Pattern

Used in:
- Claude event handling (different strategies per event type)
- Terminal input policy (decide input state based on conditions)

### 2. Dependency Injection

Used in:
- Server config injection
- File service injection
- Socket factory for testing

### 3. Interface Segregation

Small, focused interfaces:
- `IChatState` - chat messages and typing
- `ITerminalState` - terminals and selection
- `IPermissionState` - permission denials

Components depend only on interfaces they need.

### 4. Factory Pattern

Used for:
- Creating server configs
- Creating workspace file services
- Creating socket connections

## Security Considerations

### Workspace Isolation

- All file paths are normalized and checked against workspace root
- Path traversal attacks are blocked
- Example: `/api/workspace-file?path=../../etc/passwd` → 403

### Process Isolation

- Claude runs in PTY with workspace as CWD
- Terminal commands run in separate processes
- Cleanup on disconnect/shutdown

## Performance

### File Size Limits

- Text files: 512KB max (prevents huge files from freezing UI)
- Images: Served as base64

### Throttling

- Scroll-to-end throttled to 400ms
- Workspace tree refresh interval configurable (default 3s)

### Lazy Loading

- File content loaded on demand
- Preview only loads when requested
