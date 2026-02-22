/**
 * Smoke test: verify that when the user switches to a different session,
 * the old (live) session continues to receive socket output in the background.
 * When switching back, the accumulated new text should be visible.
 *
 * Covers: longer texts, multiple chunks, and different providers (Pi, Claude, Gemini).
 */
import React from "react";
import { act } from "react";
import { renderHook } from "@testing-library/react-native";
import { useSocket } from "../hooks";

// Mock-prefixed variables are allowed in jest.mock factory
const mockHandlers: { output?: (payload: string) => void } = {};
const mockSocketInstance = {
  on: jest.fn((event: string, handler: (payload: string) => void) => {
    if (event === "output") mockHandlers.output = handler;
    return mockSocketInstance;
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocketInstance),
}));

// Mock server config
jest.mock("../../server/config", () => ({
  getDefaultServerConfig: () => ({
    getBaseUrl: () => "http://localhost:3456",
    resolvePreviewUrl: (u: string) => u,
  }),
}));

/** Pi format - message_update with text_delta (recognized by event dispatcher). */
const piTextDelta = (text: string) =>
  JSON.stringify({
    type: "message_update",
    assistantMessageEvent: { type: "text_delta", delta: text },
  }) + "\n";

type ProviderConfig = { provider: "pi" | "claude" | "gemini"; model: string };
const PROVIDERS: ProviderConfig[] = [
  { provider: "pi", model: "gpt-5.1-codex-mini" },
  { provider: "claude", model: "sonnet4.5" },
  { provider: "gemini", model: "gemini-2.5-flash" },
];

describe("session switch smoke test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandlers.output = undefined;
  });

  it("live session continues receiving output when viewing a different session", () => {
    const { result } = renderHook(() => useSocket({ provider: "pi", model: "gpt-5.1-codex-mini" }));

    act(() => {
      mockHandlers.output?.(piTextDelta("Hello from "));
    });
    act(() => {
      mockHandlers.output?.(piTextDelta("live session."));
    });

    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: "assistant", content: "Hello from live session." }),
    ]);
    expect(result.current.viewingLiveSession).toBe(true);

    const savedMessages = [
      { id: "msg-1", role: "user" as const, content: "Old question" },
      { id: "msg-2", role: "assistant" as const, content: "Old answer" },
    ];

    act(() => {
      result.current.loadSession(savedMessages);
    });

    expect(result.current.viewingLiveSession).toBe(false);
    expect(result.current.messages[1].content).toBe("Old answer");

    act(() => {
      mockHandlers.output?.(piTextDelta(" This arrived while viewing saved."));
    });

    act(() => {
      result.current.switchToLiveSession();
    });

    const liveContent = result.current.messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(liveContent).toContain("Hello from live session.");
    expect(liveContent).toContain("This arrived while viewing saved.");
    expect(result.current.viewingLiveSession).toBe(true);
  });

  it.each(PROVIDERS)(
    "accumulates many chunks when viewing saved session ($provider / $model)",
    ({ provider, model }: ProviderConfig) => {
      const { result } = renderHook(() => useSocket({ provider, model }));

      // Pi format is used by the server; all providers receive it over the same socket
      const prefix = "Here is a long response that arrives in many small chunks. ";
      const chunks = prefix
        .split("")
        .concat(["E", "a", "c", "h", " ", "w", "o", "r", "d", " ", "a", "p", "p", "e", "a", "r", "s", " ", "s", "e", "p", "a", "r", "a", "t", "e", "l", "y", "."]);

      act(() => {
        chunks.forEach((c) => mockHandlers.output?.(piTextDelta(c)));
      });

      const expectedFull = chunks.join("");
      const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
      expect(assistantMsg?.content).toContain(prefix);
      expect(assistantMsg?.content).toBe(expectedFull);

      // Switch to saved session
      const savedMessages = [
        { id: "msg-1", role: "user" as const, content: "Different conversation" },
        { id: "msg-2", role: "assistant" as const, content: "Different reply" },
      ];
      act(() => {
        result.current.loadSession(savedMessages);
      });
      expect(result.current.messages[1].content).toBe("Different reply");

      // More chunks arrive while viewing saved
      const suffixChunks = [" ", "Background ", "streaming ", "continues."];
      act(() => {
        suffixChunks.forEach((c) => mockHandlers.output?.(piTextDelta(c)));
      });

      act(() => {
        result.current.switchToLiveSession();
      });

      const liveContent = result.current.messages.find((m) => m.role === "assistant")?.content ?? "";
      expect(liveContent).toBe(expectedFull + suffixChunks.join(""));
      expect(liveContent).toContain("Background streaming continues.");
    }
  );

  it("handles longer paragraph with many chunks (Pi)", () => {
    const { result } = renderHook(() => useSocket({ provider: "pi", model: "gpt-5.1-codex-mini" }));

    const paragraph =
      "This is a longer paragraph designed to simulate realistic streaming output. " +
      "The model generates text incrementally, and when the user switches sessions, " +
      "the background session must continue to accumulate all arriving chunks. " +
      "We verify that no data is lost during the switch.";
    const chunks = paragraph.match(/.{1,8}/g) ?? [paragraph]; // ~8 chars per chunk

    act(() => {
      chunks.forEach((c) => mockHandlers.output?.(piTextDelta(c)));
    });

    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg?.content).toBe(paragraph);

    // Switch away, send more, switch back
    act(() => {
      result.current.loadSession([
        { id: "msg-1", role: "user" as const, content: "Other" },
        { id: "msg-2", role: "assistant" as const, content: "Other reply" },
      ]);
    });

    const extra = " Additional text after the switch. The live session keeps growing.";
    const extraChunks = extra.match(/.{1,6}/g) ?? [extra];
    act(() => {
      extraChunks.forEach((c) => mockHandlers.output?.(piTextDelta(c)));
    });

    act(() => {
      result.current.switchToLiveSession();
    });

    const liveContent = result.current.messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(liveContent).toBe(paragraph + extra);
  });
});
