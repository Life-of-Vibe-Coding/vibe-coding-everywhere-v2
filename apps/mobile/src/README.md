# Mobile App Source Structure

This directory contains the React Native mobile app source code, organized by feature/domain for better maintainability.

## Directory Structure

```
src/
├── components/          # React components organized by feature
│   ├── chat/           # Chat-related components
│   │   ├── AskQuestionModal.tsx
│   │   ├── InputPanel.tsx
│   │   └── MessageBubble.tsx
│   ├── common/         # Shared/common components
│   │   └── PermissionDenialBanner.tsx
│   ├── file/           # File management components
│   │   ├── FileViewerModal.tsx
│   │   └── WorkspaceSidebar.tsx
│   └── preview/        # Preview/render components
│       ├── PreviewWebViewModal.tsx
│       ├── RenderPreviewBar.tsx
│       ├── RunAndPreviewPage.tsx
│       └── RunOutputView.tsx
├── core/               # Core domain types and interfaces
│   ├── types.ts        # Domain types (Message, TerminalState, etc.)
│   └── index.ts        # Re-exports
├── services/           # Services organized by domain
│   ├── sse/            # SSE integration
│   │   └── hooks.ts    # useChat hook
│   ├── server/         # Server configuration
│   │   ├── config.ts   # Server URL/config
│   │   └── url.ts      # URL utilities
│   ├── file/           # File service
│   │   └── service.ts  # Workspace file operations
│   └── providers/      # AI provider integration
│       ├── types.ts    # Shared types and helpers
│       ├── claude/     # Claude event handlers
│       └── gemini/     # Gemini event handlers
└── theme/
    └── index.ts        # Theme configuration
```

## Key Principles

1. **Components** are organized by feature (chat, file, preview, common)
2. **Core** contains only types and interfaces (no implementations)
3. **Services** contain all business logic, organized by domain
4. **Theme** is centralized for consistent styling

## Import Patterns

```typescript
// From components
import { MessageBubble } from "./components/chat/MessageBubble";

// From core (types only)
import type { Message, TerminalState } from "./core/types";

// From services
import { useChat } from "./services/chat/hooks";
import { theme } from "./theme/index";
```
