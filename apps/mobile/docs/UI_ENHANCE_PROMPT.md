# Mobile Chat UI Enhancement Prompt

A structured prompt for improving chat session switching, message bubble loading, and scroll-to-bottom behavior in the Vibe Coding mobile app (React Native / Expo). Enriched with UI/UX Pro Max principles: accessibility, touch targets, performance, and animation best practices.

---

## Executive Summary

Improve the mobile chat experience with three focus areas:

1. **Smooth session switching** — Avoid abrupt content swaps when moving between saved and live sessions
2. **Smooth message bubble loading** — Messages should appear and update without jank
3. **Focus leads to bottom when generating** — On first switch to a session that is actively generating, the view should scroll to the bottom so the user sees the latest output

### UX Principles (UI/UX Pro Max)

| Priority | Principle | Application |
|----------|-----------|-------------|
| CRITICAL | Accessibility | Respect `prefers-reduced-motion`; skip or shorten entrance animations |
| CRITICAL | Touch targets | Ensure scroll-to-bottom FAB / controls meet 44×44px minimum |
| HIGH | Performance | Use transform/opacity for animations; avoid width/height animating; batch streaming updates |
| HIGH | Content jumping | Reserve space for typing indicator; avoid layout shift when bubbles appear |
| MEDIUM | Animation timing | 150–200ms micro-interactions; `Easing.out(Easing.ease)` |

---

## 1. Smooth Session Switching

**Current behavior:**

- `FlatList` uses `key={viewingLiveSession ? "live" : "saved"}`, which remounts the list on switch
- Switching between sessions causes an abrupt content swap with no transition
- Modal closes → messages change → list remounts → no visual continuity

**Target behavior:**

- Session switch should feel continuous rather than jumpy
- When switching **to** a generating session, scroll to the bottom immediately after content loads
- Consider:
  - Crossfade or short (100–150ms) opacity transition when swapping message sets
  - Avoid remounting the entire `FlatList` if possible (e.g., keep a single list and swap `data` without changing `key`, or use a layout animation)
  - If remount is necessary, use `LayoutAnimation.configureNext` or the existing `EntranceAnimation` from `src/design-system/animations.tsx` (app uses RN built-in Animated API, not Reanimated)
  - **Accessibility:** If `prefers-reduced-motion` is set, skip or shorten transitions (e.g., 0ms or 50ms)

**Technical context:**

- `viewingLiveSession` switches between `liveSessionMessages` and `savedSessionMessages`
- `loadSession()` sets `savedSessionMessages` and `viewingLiveSession = false`
- `switchToLiveSession()` sets `viewingLiveSession = true`
- `resumeLiveSession(id, messages)` loads a running session; user may switch to it while it is streaming

---

## 2. Message Bubble Load Smoothly

**Current behavior:**

- `MessageBubble` renders immediately with full content
- Long messages or complex markdown can cause visible layout jank
- No staged/entrance animation when messages appear

**Target behavior:**

- Message bubbles should enter the viewport with a subtle, quick animation (e.g., fade + translate Y ~4–8px over 150–200ms)
- Use existing **`EntranceAnimation`** from `src/design-system/animations.tsx` with `variant="slideUp"` (or `"fade"`) and `duration={motion.normal}` (~200ms); optional stagger via `delay={index * 30}` for list-like reveals
- Use **`Skeleton`** / **`SkeletonText`** from the same design system for long assistant messages while content is still streaming
- Ensure streaming content updates are **batched or throttled** so layout recalculations don't cause frame drops (React Native Markdown can be heavy)
- **Performance:** Use `transform` and `opacity` only; avoid animating `width`/`height` or causing layout jumps

**Technical context:**

- `renderItem` uses `MessageBubble` with `message`, `provider`, `showAsTailBox`, etc.
- `extraData` is `lastSessionTerminated-${messages.length}` — consider including something that changes when the last assistant message content updates so streaming triggers re-render
- `initialNumToRender={15}`, `windowSize={10}` — tune if needed for smoother scroll

---

## 3. Focus Leads to Bottom When Generating (Primary Goal)

**Current behavior:**

- `scrollToEnd` is triggered by:
  - `messages.length` changes (useEffect)
  - `onContentSizeChange` with a 400ms debounce via `lastScrollToEndTimeRef`
- When the user first switches to a session that is generating:
  - The session modal closes
  - `viewingLiveSession` becomes true (if selecting live/active chat) or `loadSession` loads messages
  - FlatList remounts or updates
  - There is no guaranteed scroll-to-bottom on "first focus" when entering a generating session

**Target behavior:**

- When the user switches **to** a session that is actively generating (`agentRunning || typingIndicator`), the chat should:
  1. Scroll to the bottom as soon as the content is visible
  2. Continue to follow the bottom as new content streams in (until user scrolls up)
- Scroll-to-bottom should run:
  - After session switch, when `viewingLiveSession` or `messages` changes **and** `(agentRunning || typingIndicator)` is true
  - On `onContentSizeChange` when generating (with a lower debounce or no debounce when it's the "first focus" case)
- If the user scrolls up while generating, do not override; only auto-scroll when they are "at bottom" (e.g., within ~50px) or when they first land on the page

**Technical context:**

- `flatListRef.current?.scrollToEnd({ animated: true })`
- `agentRunning` and `typingIndicator` indicate generation in progress
- `onContentSizeChange` fires when the last assistant bubble grows during streaming
- Current 400ms debounce may delay scroll on rapid content updates; consider:
  - Shorter debounce (e.g., 100–150ms) when `agentRunning || typingIndicator`
  - Or immediate `scrollToEnd` when `viewingLiveSession` becomes true and session is generating (useEffect with `[viewingLiveSession, agentRunning, typingIndicator]`)

---

## Implementation Checklist

- [ ] Add scroll-to-bottom in `useEffect` when `viewingLiveSession` becomes true and `(agentRunning || typingIndicator)` is true
- [ ] Reduce or remove `onContentSizeChange` debounce when generating, or add a "first focus" path that scrolls immediately
- [ ] Add subtle entrance animation for `MessageBubble` (fade + translate)
- [ ] Replace or soften `key` change on FlatList to avoid full remount; or add layout animation on session switch
- [ ] Ensure `extraData` includes something that changes when last message content updates (e.g., `currentAssistantContent` or a hash) so streaming updates trigger re-renders and `onContentSizeChange`
- [ ] Optional: Track "user has scrolled up" and skip auto-scroll when they're not at the bottom

---

## Design Tokens (for animations)

Reference: `src/design-system/animations.tsx` and `src/design-system/theme.tsx` (`motion` object).

| Token | Value | Notes |
|-------|-------|-------|
| Transition duration | 150–200ms | Use `motion.normal` from theme |
| Easing | `Easing.out(Easing.ease)` | Matches `EntranceAnimation` |
| Stagger per item | 30–50ms | Same as `StaggeredList` default `staggerDelay` |
| Scroll debounce (generating) | 100–150ms or 0 | Use 0 for "first focus" |
| Scroll debounce (idle) | 400ms | Keep current behavior |

---

## Accessibility

- **Reduced motion:** Use `useReducedMotion` (RN) or `@react-native-community/hooks`; when true, skip or shorten entrance animations and use instant transitions
- **Focus states:** Ensure scroll-to-bottom and session controls have visible focus rings for accessibility navigation
- **Screen readers:** Announce session switch and generation status appropriately (e.g., "Switched to active session, generating")

---

## UX Anti-Patterns to Avoid

| Don't | Do |
|-------|----|
| Remount entire FlatList on session switch | Swap `data` without changing `key`, or use layout animation |
| Use width/height for entrance animation | Use transform (translateY) + opacity |
| Long debounce (400ms) when generating | Shorter debounce (100–150ms) or immediate scroll on first focus |
| No placeholder for streaming content | Use `Skeleton` / `SkeletonText` for long assistant replies |
| Force scroll when user has scrolled up | Only auto-scroll when user is near bottom (~50px) or on first land |

---

## Pre-Delivery Checklist

- [ ] `prefers-reduced-motion` respected; animations disabled or shortened
- [ ] Scroll-to-bottom runs on first focus when switching to a generating session
- [ ] Touch targets ≥ 44×44px for interactive elements
- [ ] Entrance animation uses `transform`/`opacity` only (no layout-triggering anims)
- [ ] `extraData` includes last message content hash so streaming triggers re-render
- [ ] No horizontal scroll or content overflow on typical mobile widths
