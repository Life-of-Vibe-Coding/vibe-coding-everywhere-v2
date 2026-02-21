import {
  collapseIdenticalCommandSteps,
  extractBashCommandOnly,
  fillEmptyBashBlocks,
} from "../../../utils/bashContent";

describe("fillEmptyBashBlocks", () => {
  it("moves command lines below an empty bash block into the block", () => {
    const input = `**Full command chain (from workspace root)**
Terminal 1: Backend API
\`\`\`bash
\`\`\`
cd /path/to/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000`;
    const out = fillEmptyBashBlocks(input);
    expect(out).toContain("```bash\ncd /path/to/backend\npip install -r requirements.txt\nuvicorn main:app --host 0.0.0.0 --port 8000\n```");
    expect(out).not.toContain("```\n\ncd /path/to/backend");
  });

  it("leaves content unchanged when no empty bash block", () => {
    const input = "```bash\ncd x\n```";
    expect(fillEmptyBashBlocks(input)).toBe(input);
  });

  it("fills empty bash block from command lines that appear before the block", () => {
    const input = `**Full command chain (from workspace root)**
Terminal 1: Backend API
cd /path/to/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

\`\`\`bash
\`\`\``;
    const out = fillEmptyBashBlocks(input);
    expect(out).toContain("```bash\ncd /path/to/backend\npip install -r requirements.txt\nuvicorn main:app --host 0.0.0.0 --port 8000\n```");
    expect(out).toContain("Terminal 1: Backend API");
  });
});

describe("extractBashCommandOnly", () => {
  it("returns command only when block has no prose", () => {
    const raw = "cd app && npm install && npm run dev";
    expect(extractBashCommandOnly(raw)).toBe(raw);
  });

  it("strips from first non-command line onward (summary and prose)", () => {
    const raw = `source ~/.nvm/nvm.sh 2>/dev/null; nvm use 22.12.0 && cd landing-page && npm install && npm run dev --host 0.0.0.0 --port 5173
#### Command execution summary
Dependencies in landing-page/ were installed. Vite and its React plugin warn that the current Node.js runtime (v22.7.0) is below the required range.`;
    expect(extractBashCommandOnly(raw)).toBe(
      "source ~/.nvm/nvm.sh 2>/dev/null; nvm use 22.12.0 && cd landing-page && npm install && npm run dev --host 0.0.0.0 --port 5173"
    );
  });

  it("strips Full command chain and Terminal N: lines", () => {
    const raw = `**Full command chain (from workspace root)**
Terminal 1: Landing page dev server
cd server
npm run dev`;
    expect(extractBashCommandOnly(raw)).toBe("cd server\nnpm run dev");
  });

  it("keeps only runnable lines (comments and commands)", () => {
    const raw = `# optional: export VAR=value
cd /path/from/workspace/root
command1
command2`;
    expect(extractBashCommandOnly(raw)).toBe(raw);
  });

  it("returns empty string when all lines are non-command; caller falls back to raw", () => {
    const raw = `#### **Command execution summary**
**Full command chain (from workspace root)**
Terminal 1: Backend server`;
    expect(extractBashCommandOnly(raw)).toBe("");
  });

  it("strips any line ending with period (general prose rule) so full chain is pure commands", () => {
    const raw = `cd landing-page
npm run build
successfully rendered the production bundle in \`dist/\`.
Vite emitted a warning that Node.js 22.7.0 is outside its supported range.`;
    expect(extractBashCommandOnly(raw)).toBe("cd landing-page\nnpm run build");
  });

  it("strips arbitrary prose sentences after commands (general fix)", () => {
    const raw = `npm install
npm run build
The build finished. Output is in dist.
To view the page run the dev server.`;
    expect(extractBashCommandOnly(raw)).toBe("npm install\nnpm run build");
  });
});

describe("collapseIdenticalCommandSteps", () => {
  it("keeps only the last command when multiple identical command patterns in a row", () => {
    const input = `🖥 Running command:
\`sed -n '1,200p' frontend/src/App.tsx\`

🖥 Running command:
\`sed -n '1,200p' frontend/src/main.tsx\`

🖥 Running command:
\`sed -n '1,200p' frontend/vite.config.ts\``;
    const out = collapseIdenticalCommandSteps(input);
    expect(out).toContain("sed -n '1,200p' frontend/vite.config.ts");
    expect(out).not.toContain("sed -n '1,200p' frontend/src/App.tsx");
    expect(out).not.toContain("sed -n '1,200p' frontend/src/main.tsx");
  });

  it("keeps different command patterns as separate steps", () => {
    const input = `🖥 Running command:
\`ls frontend\`

🖥 Running command:
\`cat frontend/package.json\`

🖥 Running command:
\`ls frontend/src\``;
    const out = collapseIdenticalCommandSteps(input);
    expect(out).toContain("ls frontend");
    expect(out).toContain("cat frontend/package.json");
    expect(out).toContain("ls frontend/src");
  });

  it("leaves content unchanged when fewer than two command blocks", () => {
    const single = `Some text\n\n🖥 Running command:\n\`echo hi\``;
    expect(collapseIdenticalCommandSteps(single)).toBe(single);
  });
});
