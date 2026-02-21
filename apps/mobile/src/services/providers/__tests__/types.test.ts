/**
 * Unit tests for formatToolUseForDisplay and tool name normalization.
 * Ensures bash/shell tools render in terminal format regardless of provider naming.
 */
import { formatToolUseForDisplay } from "../types";

describe("formatToolUseForDisplay", () => {
  describe("Bash/shell tool normalization", () => {
    it("formats run_shell_command with command in terminal format", () => {
      const out = formatToolUseForDisplay("run_shell_command", { command: "npm install" });
      expect(out).toContain("Running command:");
      expect(out).toContain("`npm install`");
    });

    it("formats bash (lowercase) with command in terminal format", () => {
      const out = formatToolUseForDisplay("bash", { command: "ls -la" });
      expect(out).toContain("Running command:");
      expect(out).toContain("`ls -la`");
    });

    it("formats Bash (capitalized) with command in terminal format", () => {
      const out = formatToolUseForDisplay("Bash", { command: "cd /tmp" });
      expect(out).toContain("Running command:");
      expect(out).toContain("`cd /tmp`");
    });

    it("extracts command from obj.args when present (Pi/OpenAI schema)", () => {
      const out = formatToolUseForDisplay("bash", { args: { command: "echo hello" } });
      expect(out).toContain("Running command:");
      expect(out).toContain("`echo hello`");
    });

    it("does not fall back to default (plain **bash**) for bash tool name", () => {
      const out = formatToolUseForDisplay("bash", { command: "" });
      expect(out).not.toMatch(/\*\*bash\*\*/);
      expect(out).toBe("Running command");
    });
  });
});
