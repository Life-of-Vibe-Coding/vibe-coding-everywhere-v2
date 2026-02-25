/**
 * Smoke test: verify selected-session single SSE lifecycle behavior.
 */
import { act } from "react";
import { renderHook } from "@testing-library/react-native";
import { useSse } from "../hooks";

interface MockListener {
  (event: any): void;
}

type MockEventSource = {
  url: string;
  listeners: Map<string, MockListener[]>;
  closed: boolean;
  addEventListener: (event: string, handler: MockListener) => void;
  removeEventListener: (event: string, handler: MockListener) => void;
  emit: (event: string, data?: any) => void;
  close: () => void;
};
const mockEventSources: MockEventSource[] = [];
const getAllSources = () => mockEventSources;
const getLatestSource = () => mockEventSources[mockEventSources.length - 1];

jest.mock("react-native-sse", () => {
  const MockEventSourceCtor: any = function (this: any, url: string) {
    this.url = url;
    this.listeners = new Map<string, MockListener[]>();
    this.closed = false;
    mockEventSources.push(this);
  };

  MockEventSourceCtor.prototype.addEventListener = function (
    this: MockEventSource,
    event: string,
    handler: MockListener
  ) {
    const current = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...current, handler]);
    return this;
  };

  MockEventSourceCtor.prototype.removeEventListener = function (
    this: MockEventSource,
    event: string,
    handler: MockListener
  ) {
    const current = this.listeners.get(event);
    if (!current) return;
    const next = current.filter((h) => h !== handler);
    if (next.length) this.listeners.set(event, next);
    else this.listeners.delete(event);
  };

  MockEventSourceCtor.prototype.emit = function (this: MockEventSource, event: string, data?: any) {
    const handlers = this.listeners.get(event) ?? [];
    handlers.forEach((h) => h({ data: data ?? "" }));
  };

  MockEventSourceCtor.prototype.close = function (this: MockEventSource) {
    this.closed = true;
  };

  MockEventSourceCtor.default = MockEventSourceCtor;
  return MockEventSourceCtor as any;
});

jest.mock("../../server/config", () => ({
  getDefaultServerConfig: () => ({
    getBaseUrl: () => "http://localhost:3456",
    resolvePreviewUrl: (u: string) => u,
  }),
}));

describe("session switch smoke test", () => {
  beforeEach(() => {
    mockEventSources.length = 0;
  });

  it("opens a stream only for selected active session", () => {
    const { result } = renderHook(() =>
      useSse({
        provider: "codex",
        model: "gpt-5.1-codex-mini",
        sessionId: "running-session",
        status: true,
      })
    );

    const source = getLatestSource();
    expect(source).toBeDefined();
    expect(source.url).toBe("http://localhost:3456/api/sessions/running-session/stream?activeOnly=1");

    act(() => {
      source.emit("open");
    });

    expect(result.current.connected).toBe(true);
  });

  it("does not open SSE when selected stream is not running", () => {
      const { rerender } = renderHook((props: { sessionId: string; status: boolean }) =>
        useSse({
          provider: "codex",
          model: "gpt-5.1-codex-mini",
          sessionId: props.sessionId,
          status: props.status,
      })
    , {
      initialProps: {
        sessionId: "running-session",
        status: false,
      },
    });

    expect(getAllSources()).toHaveLength(0);

    act(() => {
      rerender({ sessionId: "running-session", status: true });
    });

    expect(getAllSources()).toHaveLength(1);
  });

  it("switches sessions with close-before-open semantics", () => {
    const { rerender } = renderHook((props: { sessionId: string; status: boolean }) =>
      useSse({
        provider: "codex",
        model: "gpt-5.1-codex-mini",
        sessionId: props.sessionId,
        status: props.status,
      })
    , {
      initialProps: {
        sessionId: "session-a",
        status: true,
      },
    });

    const first = getLatestSource();
    expect(first).toBeDefined();
    act(() => {
      first.emit("open");
    });

    act(() => {
      rerender({ sessionId: "session-b", status: true });
    });

    const second = getLatestSource();
    expect(first.closed).toBe(true);
    expect(second).not.toBe(first);
    expect(second.url).toContain("/api/sessions/session-b/stream?activeOnly=1");
    expect(getAllSources()).toHaveLength(2);
    expect(getAllSources()[1]).toBe(second);

    act(() => {
      second.emit("open");
    });
    expect(getAllSources()[1].url).toContain("session-b");
  });

  it("applies skipReplay=1 when reopening a resumed live session with seeded messages", () => {
    const seedMessages = [
      { id: "msg-1", role: "user" as const, content: "Existing" },
      { id: "msg-2", role: "assistant" as const, content: "Message" },
    ];

    const { result, rerender } = renderHook((props: { sessionId: string; status: boolean }) =>
      useSse({
        provider: "codex",
        model: "gpt-5.1-codex-mini",
        sessionId: props.sessionId,
        status: props.status,
      })
    , {
      initialProps: {
        sessionId: "seed-session",
        status: false,
      },
    });

    act(() => {
      result.current.resumeLiveSession("seed-session-active", seedMessages);
    });

    act(() => {
      rerender({ sessionId: "seed-session-active", status: true });
    });

    const source = getLatestSource();
    expect(source.url).toContain("/api/sessions/seed-session-active/stream?activeOnly=1&skipReplay=1");
  });

  it("finalizes and closes stream on end without auto-reconnecting", () => {
    const { result } = renderHook(() =>
      useSse({
        provider: "codex",
        model: "gpt-5.1-codex-mini",
        sessionId: "ending-session",
        status: true,
      })
    );

    const source = getLatestSource();
    act(() => {
      source.emit("open");
      source.emit("end", JSON.stringify({ exitCode: 0 }));
    });

    expect(source.closed).toBe(true);
    expect(result.current.connected).toBe(false);
    expect(getAllSources()).toHaveLength(1);

    act(() => {
      source.emit("open");
    });

    expect(source.closed).toBe(true);
    expect(result.current.connected).toBe(false);
  });

  it("re-keys an in-memory stream when backend migrates session id", () => {
    const { result } = renderHook(() =>
      useSse({
        provider: "codex",
        model: "gpt-5.1-codex-mini",
        sessionId: "legacy-session",
        status: true,
      })
    );

    const source = getLatestSource();
    act(() => {
      source.emit("open");
      source.emit("message", JSON.stringify({
        type: "session-started",
        session_id: "migrated-session",
        permissionMode: null,
        allowedTools: [],
        useContinue: false,
      }));
    });

    expect(result.current.sessionId).toBe("migrated-session");
    expect(source.closed).toBe(false);
    expect(getAllSources()).toHaveLength(1);
  });
});
