import { createEventDispatcher } from "../eventDispatcher";

describe("eventDispatcher", () => {
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
