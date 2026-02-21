# Development Guide

Guide for developers working on this project.

## Project Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Pi coding agent: `npm i -g @mariozechner/pi-coding-agent`
- (Optional) Xcode for iOS development
- (Optional) Android Studio for Android development

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd vibe-coding-everywhere

# Install dependencies
npm install

# Verify Pi is accessible
pi --version
```

## Development Workflows

### Server Development

```bash
# Start with auto-restart
npm run dev

# Or start normally
npm start

# With custom workspace
npm start -- /path/to/project

# With custom port
PORT=3457 npm start
```

### Web Client Development

The web client is served automatically by the server. No separate build step needed.

```bash
# Start server
npm start

# Open browser
open http://localhost:3456
```

### Mobile Development

#### Option 1: Simulator (Local)

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Start Expo
npm run dev:mobile
```

Press `i` for iOS Simulator or `a` for Android Emulator.

#### Option 2: Physical Device (Tailscale)

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Start with tunnel
npm run dev:mobile:funnel
```

Scan QR code with Expo Go app.

## Project Structure

### Root Level

```
vibe-coding-everywhere/
├── server.js           # Main server entry
├── server/             # Server modules
├── apps/
│   └── mobile/         # React Native app
├── prompts/            # System prompts
├── scripts/            # Build/utility scripts
├── docs/               # Documentation
└── package.json
```

### Server Modules

```
server/
├── config/       # Environment setup
├── routes/       # HTTP endpoints
├── socket/       # WebSocket handlers
├── process/      # AI provider (piRpcSession.js)
├── prompts/      # Pi system prompt loading
└── utils/        # Shared utilities
```

### Mobile App

```
apps/mobile/src/
├── components/   # React components
│   ├── chat/
│   ├── file/
│   ├── preview/
│   └── common/
├── services/     # Business logic
│   ├── socket/
│   ├── server/
│   ├── file/
│   └── providers/  # AI event handlers (claude/, gemini/)
├── core/         # Types & interfaces
└── theme/        # Styling
```

## Adding Features

### Adding a New API Endpoint

1. Add route handler in `server/routes/index.js`:

```javascript
app.get("/api/my-endpoint", (req, res) => {
  // Implementation
  res.json({ result: "success" });
});
```

2. Test with curl or browser:

```bash
curl http://localhost:3456/api/my-endpoint
```

### Adding a New Socket Event

1. Add handler in `server/socket/index.js`:

```javascript
socket.on("my-event", (payload) => {
  console.log("Received:", payload);
  socket.emit("my-response", { status: "ok" });
});
```

2. Emit from client:

```javascript
socket.emit("my-event", { data: "test" });
socket.on("my-response", (response) => {
  console.log(response);
});
```

### Adding an AI Provider Event Handler

1. Add handler in `apps/mobile/src/services/providers/<provider>/eventHandlers.ts`:

```typescript
registry.set("my_event", (data, ctx) => {
  ctx.addMessage("system", `Received: ${data.message}`);
});
```

### Adding a Mobile Component

1. Create component in appropriate directory:

```typescript
// apps/mobile/src/components/chat/MyComponent.tsx
import React from "react";
import { View, Text } from "react-native";
import { theme } from "../../theme/index";

export function MyComponent({ title }: { title: string }) {
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: theme.textPrimary }}>{title}</Text>
    </View>
  );
}
```

2. Import and use in `App.tsx`:

```typescript
import { MyComponent } from "./src/components/chat/MyComponent";

// ...
<MyComponent title="Hello" />
```

## Debugging

### Server Debugging

```bash
# Enable verbose logging
DEBUG=* npm start

# Check AI output logs
ls logs/claude/ logs/gemini/
cat logs/claude/claude-output-*.log
cat logs/gemini/gemini-output-*.log
```

### Mobile Debugging

```bash
# Start with clear console
npm run dev:mobile -- --clear

# iOS Simulator logs
npx react-native log-ios

# Android logs
npx react-native log-android
```

### Common Issues

**Mobile can't connect:**

```bash
# Check server is running
curl http://localhost:3456/api/config

# Check Tailscale status (if using)
tailscale status
```

**Claude not found:**

```bash
# Verify installation
which claude
claude --version

# Add to PATH if needed
export PATH="$PATH:/path/to/claude"
```

**Port already in use:**

```bash
# Find process
lsof -i :3456

# Kill process
kill -9 <PID>

# Or use different port
PORT=3457 npm start
```

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server port |
| `WORKSPACE` | Server dir | AI CLI working directory |
| `DEFAULT_PROVIDER` | `gemini` | AI provider: `claude` or `gemini` |
| `DEFAULT_PERMISSION_MODE` | `bypassPermissions` | Claude permission mode |
| `DEFAULT_GEMINI_APPROVAL_MODE` | `auto_edit` | Gemini approval mode |
| `SIDEBAR_REFRESH_INTERVAL_MS` | `3000` | File tree refresh |

### Mobile

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SERVER_URL` | Server URL |
| `EXPO_PUBLIC_DEFAULT_PERMISSION_MODE` | Default permissions |
| `EXPO_PUBLIC_PREVIEW_HOST` | Preview host override |

## Code Style

### TypeScript/JavaScript

- Use TypeScript for type safety
- Prefer interfaces over types
- Use functional components with hooks
- Avoid `any` when possible

### Naming Conventions

- Components: PascalCase (`MessageBubble`)
- Hooks: camelCase starting with `use` (`useSocket`)
- Interfaces: Prefix with `I` (`IServerConfig`)
- Files: Match default export name

### Imports

```typescript
// External dependencies first
import React from "react";
import { View } from "react-native";

// Internal absolute imports
import { useSocket } from "./services/socket/hooks";

// Internal relative imports
import { MessageBubble } from "../chat/MessageBubble";

// Types
import type { Message } from "../../core/types";
```

## Building for Production

### Server

No build step needed. Run directly:

```bash
npm start
```

### Mobile

```bash
cd apps/mobile

# iOS
npm run ios

# Android
npm run android

# Build for stores (requires setup)
npx expo build:ios
npx expo build:android
```

## Testing

### Manual Testing Checklist

- [ ] Server starts without errors
- [ ] Web client loads and connects
- [ ] Mobile app connects (local)
- [ ] Mobile app connects (Tailscale)
- [ ] AI session starts (Claude or Gemini)
- [ ] Messages display correctly
- [ ] File tree loads
- [ ] File viewer opens files
- [ ] Terminal commands execute
- [ ] Preview loads

### Testing Workflows

**Basic chat:**
1. Send a simple prompt
2. Verify response displays
3. Check for errors in console

**File operations:**
1. Open sidebar
2. Click a file
3. Verify content displays

**Terminal:**
1. Run a command
2. Verify output streams
3. Kill process works

## Troubleshooting

### Server Issues

**Error: Cannot find module 'node-pty'**

```bash
npm run postinstall
```

**Error: AI CLI not found**

Install Pi: `npm i -g @mariozechner/pi-coding-agent`

### Mobile Issues

**Metro bundler won't start:**

```bash
npx expo start --clear
```

**App crashes on launch:**

Check `EXPO_PUBLIC_SERVER_URL` is set correctly.

**Socket connection fails:**

Verify server is running and accessible from device.
