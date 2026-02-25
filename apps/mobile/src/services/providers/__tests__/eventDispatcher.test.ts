import { createEventDispatcher } from "@/services/providers/eventDispatcher";

describe("eventDispatcher", () => {
  it("ignores agent_end events (no UI state mutation)", () => {
    const mockCtx = {
      appendAssistantText: jest.fn(),
      setCurrentActivity: jest.fn(),
      addMessage: jest.fn(),
      setWaitingForUserInput: jest.fn(),
      setPermissionDenials: jest.fn(),
      setPendingAskQuestion: jest.fn(),
      deduplicateDenials: jest.fn((d) => d),
      getCurrentAssistantContent: jest.fn(() => ""),
    } as any;

    const dispatch = createEventDispatcher(mockCtx);

    dispatch({
      type: "agent_end",
      messages: [],
    });

    expect(mockCtx.appendAssistantText).not.toHaveBeenCalled();
    expect(mockCtx.setCurrentActivity).not.toHaveBeenCalled();
    expect(mockCtx.setWaitingForUserInput).not.toHaveBeenCalled();
    expect(mockCtx.setPermissionDenials).not.toHaveBeenCalled();
    expect(mockCtx.setPendingAskQuestion).not.toHaveBeenCalled();
    expect(mockCtx.addMessage).not.toHaveBeenCalled();
  });

  it("wraps thinking_start, thinking_delta, thinking_end correctly", () => {
    let appendedText = "";
    
    // Mock context
    const mockCtx = {
      appendAssistantText: jest.fn((text) => {
        appendedText += text;
      }),
      setCurrentActivity: jest.fn(),
      addMessage: jest.fn(),
      setWaitingForUserInput: jest.fn(),
      setPermissionDenials: jest.fn(),
      setPendingAskQuestion: jest.fn(),
      deduplicateDenials: jest.fn((d) => d),
      getCurrentAssistantContent: jest.fn(() => appendedText),
    } as any;

    const dispatch = createEventDispatcher(mockCtx);

    dispatch({
      type: "message_update",
      assistantMessageEvent: {
        type: "thinking_start"
      }
    });

    dispatch({
      type: "message_update",
      assistantMessageEvent: {
        type: "thinking_delta",
        delta: "I am thinking..."
      }
    });

    dispatch({
      type: "message_update",
      assistantMessageEvent: {
        type: "thinking_end"
      }
    });

    expect(mockCtx.appendAssistantText).toHaveBeenCalledTimes(3);
    expect(appendedText).toBe("<think>\nI am thinking...\n</think>\n\n");
  });
});
