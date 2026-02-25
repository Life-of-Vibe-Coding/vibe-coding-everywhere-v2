/**
 * Unit tests for chat stream parsing.
 * Covers command-style tags (<u 'command' u>...)
 * extractRenderCommandAndUrl, stripCommandStyleTags, and related parsing.
 */
import {
  stripCommandStyleTags,
  stripTrailingIncompleteTag,
  stripAnsi,
  extractRenderCommandAndUrl,
  filterBashNoise,
  isProviderStream,
  isCodexStreamOutput,
  RENDER_CMD_REGEX,
  RENDER_URL_REGEX,
} from "@/services/providers/stream";

describe("stripCommandStyleTags / stripTrailingIncompleteTag", () => {
  describe("single command in one message", () => {
    it("strips opening tag and closing tag, preserves content", () => {
      const input = `<u 'command' u>ls -la</u>`;
      expect(stripCommandStyleTags(input)).toBe("ls -la");
      expect(stripTrailingIncompleteTag(input)).toBe("ls -la");
    });

    it("handles tag with no spaces", () => {
      const input = `<u'command'u>echo hello</u>`;
      expect(stripCommandStyleTags(input)).toBe("echo hello");
    });

    it("handles tag with extra spaces", () => {
      const input = `<u  'command'  u>npm install</u>`;
      expect(stripCommandStyleTags(input)).toBe("npm install");
    });
  });

  describe("multiple commands", () => {
    it("strips multiple command spans", () => {
      const input = `First: <u 'command' u>cmd1</u> then <u 'command' u>cmd2</u>`;
      expect(stripCommandStyleTags(input)).toBe("First: cmd1 then cmd2");
    });
  });

  describe("command mixed with plain text and code blocks", () => {
    it("preserves surrounding text", () => {
      const input = `Run this: <u 'command' u>git status</u> to see changes.`;
      expect(stripCommandStyleTags(input)).toBe("Run this: git status to see changes.");
    });

    it("preserves newlines", () => {
      const input = `Line 1\n<u 'command' u>ls</u>\nLine 3`;
      expect(stripCommandStyleTags(input)).toBe("Line 1\nls\nLine 3");
    });
  });

  describe("incomplete or chunked stream segments", () => {
    it("removes trailing incomplete opening tag", () => {
      const input = `Some text <u 'command`;
      expect(stripCommandStyleTags(input)).toBe("Some text ");
    });

    it("removes trailing incomplete closing tag", () => {
      const input = `ls -la</u`;
      expect(stripCommandStyleTags(input)).toBe("ls -la");
    });

    it("handles complete content with trailing partial tag", () => {
      const input = `Run <u 'command' u>echo ok</u> then <u 'com`;
      expect(stripCommandStyleTags(input)).toBe("Run echo ok then ");
    });
  });

  describe("streaming: tag split across chunks", () => {
    it("strips leading fragment when content starts with tail of opening tag", () => {
      // Chunk2 arrived without chunk1: content is just "' u>ls -la</u>"
      const input = `' u>ls -la</u>`;
      expect(stripCommandStyleTags(input)).toBe("ls -la");
    });

    it("strips leading fragment with quoted name", () => {
      const input = `' command' u>npm run build</u>`;
      expect(stripCommandStyleTags(input)).toBe("npm run build");
    });

    it("accumulated content with tag split across chunks strips to plain text", () => {
      // Simulate chunks: "<u 'command" then "' u>ls</u>" → accumulated
      const accumulated = "<u 'command' u>ls</u>";
      expect(stripCommandStyleTags(accumulated)).toBe("ls");
    });

    it("accumulated content with leading fragment only (missing first chunk)", () => {
      const input = `' u>git status</u>`;
      expect(stripCommandStyleTags(input)).toBe("git status");
    });

    it("strips leading bare <u when PTY injected before JSON (not a command tag)", () => {
      const input = `<u{"type":"system","subtype":"init","cwd":"/tmp"}`;
      expect(stripCommandStyleTags(input)).toBe(`{"type":"system","subtype":"init","cwd":"/tmp"}`);
    });
  });

  describe("escaped or special characters inside command text", () => {
    it("preserves special shell characters", () => {
      const input = `<u 'command' u>echo "hello $USER" && ls -la</u>`;
      expect(stripCommandStyleTags(input)).toBe(`echo "hello $USER" && ls -la`);
    });

    it("preserves backticks", () => {
      const input = "`<u 'command' u>npm run build`</u>";
      expect(stripCommandStyleTags(input)).toBe("`npm run build`");
    });
  });

  describe("edge cases", () => {
    it("returns empty for null/undefined", () => {
      expect(stripTrailingIncompleteTag("")).toBe("");
    });

    it("handles text with no tags", () => {
      const input = "Plain text without any tags.";
      expect(stripCommandStyleTags(input)).toBe(input);
    });
  });
});

describe("extractRenderCommandAndUrl", () => {
  it("extracts command and URL when both present (quoted)", () => {
    const text = `Run the following command for render: "npm run dev"
URL for preview: "http://localhost:5173"`;
    expect(extractRenderCommandAndUrl(text)).toEqual({
      command: "npm run dev",
      url: "http://localhost:5173",
    });
  });

  it("extracts command and URL when URL is bare (keyin)", () => {
    const text = `Run the following command for render: "npm run dev"
URL for preview: http://yifans-macbook-pro-tail145574.net/`;
    expect(extractRenderCommandAndUrl(text)).toEqual({
      command: "npm run dev",
      url: "http://yifans-macbook-pro-tail145574.net/",
    });
  });

  it("returns null when command missing", () => {
    const text = `URL for preview: "http://localhost:5173"`;
    expect(extractRenderCommandAndUrl(text)).toBeNull();
  });

  it("returns null when URL missing", () => {
    const text = `Run the following command for render: "npm run dev"`;
    expect(extractRenderCommandAndUrl(text)).toBeNull();
  });

  it("returns null for Need permission message", () => {
    const text = `Need permission for the following commands:
Run the following command for render: "npm run dev"
URL for preview: "http://localhost:5173"`;
    expect(extractRenderCommandAndUrl(text)).toBeNull();
  });
});

describe("stripAnsi", () => {
  it("removes ANSI escape codes", () => {
    const input = "\x1b[31mRed\x1b[0m text";
    expect(stripAnsi(input)).toBe("Red text");
  });
});

describe("filterBashNoise", () => {
  it("strips command tags from terminal output", () => {
    const input = `<u 'command' u>ls -la</u>`;
    expect(filterBashNoise(input)).toBe("ls -la");
  });
});

describe("isProviderStream", () => {
  it("returns true for Pi RPC event types", () => {
    expect(isProviderStream({ type: "agent_start" })).toBe(true);
    expect(isProviderStream({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "hi" } })).toBe(true);
    expect(isProviderStream({ type: "turn_end", message: {} })).toBe(true);
    expect(isProviderStream({ type: "tool_execution_start", toolName: "bash" })).toBe(true);
  });

  it("returns true for permission_denials and AskUserQuestion", () => {
    expect(isProviderStream({ permission_denials: [{ tool_name: "Read" }] })).toBe(true);
    expect(isProviderStream({ tool_name: "AskUserQuestion", tool_use_id: "x", tool_input: { questions: [{ header: "Choose", options: [] }] } })).toBe(true);
  });

  it("returns false for non-Pi event types", () => {
    expect(isProviderStream({ type: "assistant" })).toBe(false);
    expect(isProviderStream({ type: "thread.started" })).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isProviderStream("hello")).toBe(false);
    expect(isProviderStream({ foo: "bar" })).toBe(false);
  });
});

describe("isCodexStreamOutput", () => {
  it("returns true for thread.started with thread_id", () => {
    expect(isCodexStreamOutput({ type: "thread.started", thread_id: "0199a213-81c0-7800-8aa1-bbab2a035a53" })).toBe(true);
  });

  it("returns true for item.completed", () => {
    expect(isCodexStreamOutput({ type: "item.completed", item: { id: "item_1", type: "agent_message", text: "Hello" } })).toBe(true);
  });

  it("returns false for Claude/Gemini types", () => {
    expect(isCodexStreamOutput({ type: "assistant" })).toBe(false);
    expect(isCodexStreamOutput({ type: "init" })).toBe(false);
  });
});

describe("RENDER_CMD_REGEX and RENDER_URL_REGEX", () => {
  it("RENDER_CMD_REGEX matches expected format", () => {
    const m = `Run the following command for render: "npm start"`.match(RENDER_CMD_REGEX);
    expect(m?.[1]).toBe("npm start");
  });

  it("RENDER_URL_REGEX matches quoted URL", () => {
    const m = `URL for preview: "https://example.com"`.match(RENDER_URL_REGEX);
    expect(m?.[1]).toBe("https://example.com");
  });

  it("RENDER_URL_REGEX matches bare URL (keyin)", () => {
    const m = `URL for preview: http://yifans-macbook-pro-tail145574.net/`.match(RENDER_URL_REGEX);
    expect(m?.[2]).toBe("http://yifans-macbook-pro-tail145574.net/");
  });
});
