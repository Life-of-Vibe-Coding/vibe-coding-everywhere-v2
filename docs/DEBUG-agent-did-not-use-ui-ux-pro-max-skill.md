# Systematic Debug: Why the Agent Did Not Use ui-ux-pro-max Skill

## Phase 1: Root Cause Investigation

### 1. Symptom

User asked: "Improve the ui ux experience of index.html"

The agent (Gemini via Pi RPC) made UI/UX improvements (glassmorphism, hover states, mobile nav, etc.) but did **not** use the `ui-ux-pro-max` skill. When asked "Did you use any skill for improvement", the agent replied it "effectively utilized a UI/UX design intelligence approach" but did **not** invoke the skill's protocol (e.g. run `python3 skills/ui-ux-pro-max/scripts/search.py ... --design-system`).

### 2. Data Flow Trace

Skills reach the Pi agent through this chain:

```
User enables skills in mobile app
    → POST /api/skills-enabled { enabledIds: ["ui-ux-pro-max", ...] }
    → setEnabledIds(agentDir) writes to <agentDir>/skills-enabled.json

Pi RPC session starts (ensurePiProcess)
    → resolveAgentDir(cwd, projectRoot)  →  agent dir for workspace or project
    → getEnabledIds(agentDir)            →  reads skills-enabled.json
    → syncEnabledSkillsFolder(SKILLS_DIR, agentDir, skillsEnabledDir)
    → for each enabled skill: args.push("--skill", path)
    → spawn("pi", ["--mode", "rpc", "--no-skills", "--skill", path1, "--skill", path2, ...])
```

**Critical condition**: Skills are passed to Pi **only if** `getEnabledIds(agentDir)` returns a non-empty array containing `"ui-ux-pro-max"`.

### 3. Root Cause Hypotheses

| # | Hypothesis | How to verify |
|---|------------|---------------|
| H1 | **ui-ux-pro-max not enabled** — `skills-enabled.json` missing or does not include `ui-ux-pro-max` | Check `getWorkspaceCwd()/.pi/agent/skills-enabled.json` or `projectRoot/.pi/agent/skills-enabled.json` |
| H2 | **agentDir is null** — `resolveAgentDir` returns null, so `getEnabledIds(null)` returns [] | Add logging in piRpcSession: log `skillsAgentDir`, `skillPaths` |
| H3 | **SKILLS_DIR mismatch** — ui-ux-pro-max lives elsewhere, sync fails | SKILLS_DIR = projectRoot/skills (default). Skill exists at `skills/ui-ux-pro-max/SKILL.md`. Verify config. |
| H4 | **Pi CLI ignores --skill** — Pi receives skills but does not load/inject them | Inspect Pi CLI source or docs for --skill behavior |
| H5 | **Skill loaded but model ignored it** — Content injected but model chose not to follow | Would require Pi to inject skill content; if H1–H2 are false, this is plausible |

### 4. Evidence Gathered

#### 4.1 Code Path Analysis

- **`getEnabledIds(agentDir)`** (`server/skills/index.js:214-227`):
  - Returns `[]` if `!agentDir`
  - Returns `[]` if `!fs.existsSync(filePath)` (skills-enabled.json missing)
  - Returns `[]` on parse error
  - Otherwise returns `data.enabledIds` (filtered)

- **`resolveAgentDir(cwd, projectRoot)`** (`server/skills/index.js:194-206`):
  - Prefers workspace `cwd/.pi/agent` if `auth.json` exists
  - Else project `projectRoot/.pi/agent` if `auth.json` exists
  - Else workspace `.pi/agent` if dir exists
  - Else project `.pi/agent` if dir exists
  - Else `projectAgentDir` if projectRoot is set (path returned even if dir does not exist)
  - Else `null`

- **`syncEnabledSkillsFolder`** (`server/skills/index.js:284-331`):
  - If `enabledIds.length === 0` → returns `[]` immediately (no `--skill` flags)

#### 4.2 Config

- **SKILLS_DIR**: `projectRoot/skills` (from `server/config/index.js`)
- **Skill presence**: `skills/ui-ux-pro-max/SKILL.md` exists

#### 4.3 Session Context

- Session cwd: `workspace_for_testing`
- Provider: `google-gemini-cli` (Pi using Gemini)
- `.pi/` is gitignored; cannot inspect `skills-enabled.json` in repo

### 5. Most Likely Root Cause

**H1: ui-ux-pro-max was not in the enabled skills list.**

Reasons:
1. `syncEnabledSkillsFolder` returns `[]` when `getEnabledIds(agentDir)` is empty.
2. No `--skill` flags are passed → Pi runs with `--no-skills` only → no skill content is loaded.
3. The agent’s reply ("I effectively utilized a UI/UX design intelligence approach") reflects general UI knowledge, not skill content, because the skill was never injected.

Secondary possibility: **agentDir was null** (no `.pi/agent` in workspace or project), so `getEnabledIds` always returns `[]`.

---

## Phase 2: Verification Steps

To confirm, add diagnostics in `ensurePiProcess` (or run manually):

```javascript
// In piRpcSession.js ensurePiProcess, after syncEnabledSkillsFolder:
const skillsAgentDir = resolveAgentDir(cwd, projectRoot);
const skillPaths = syncEnabledSkillsFolder(SKILLS_DIR, skillsAgentDir, skillsEnabledDir);
console.log("[pi] skills agentDir:", skillsAgentDir);
console.log("[pi] skills-enabled.json exists:", skillsAgentDir ? fs.existsSync(path.join(skillsAgentDir, "skills-enabled.json")) : "N/A");
console.log("[pi] enabled skill paths:", skillPaths);
```

Or inspect at runtime:

```bash
# From project root, with workspace = workspace_for_testing
ls -la workspace_for_testing/.pi/agent/ 2>/dev/null || ls -la .pi/agent/ 2>/dev/null
cat workspace_for_testing/.pi/agent/skills-enabled.json 2>/dev/null || cat .pi/agent/skills-enabled.json 2>/dev/null
```

---

## Phase 3: Fix (Once Root Cause Confirmed)

If H1: **Enable ui-ux-pro-max in the mobile app** (Settings → Skills → enable ui-ux-pro-max), or via API:

```bash
curl -X POST http://localhost:PORT/api/skills-enabled \
  -H "Content-Type: application/json" \
  -d '{"enabledIds": ["ui-ux-pro-max"]}'
```

If agentDir is null: Ensure `.pi/agent` exists in workspace or project. The first successful POST to `/api/skills-enabled` creates it via `setEnabledIds` (which calls `fs.mkdirSync`).

---

## Phase 4: ui-ux-pro-max Skill Design Note

Even when loaded, the skill requires the agent to **run** `search.py --design-system`. The `loadEnabledSkillsContent` preamble says:

> "apply ONLY when the user's message clearly matches the skill's intended use"

"Improve the ui ux experience of index.html" clearly matches. So if the skill *were* loaded, the model might still skip the script. To increase compliance:

- Strengthen the skill’s "When to Apply" so the design-system step is mandatory for UI/UX improvement requests.
- Or add an explicit "Run this command first" instruction for UI/UX tasks.

---

## Summary

| Phase | Finding |
|-------|---------|
| **Root cause** | ui-ux-pro-max was almost certainly not passed to Pi because it was not in the enabled skills list (`skills-enabled.json` empty or missing the skill), or `agentDir` was null. |
| **Verification** | Add logging for `agentDir`, `skillPaths`; inspect `skills-enabled.json` on disk. |
| **Fix** | Enable ui-ux-pro-max in Settings or via API; ensure `.pi/agent` exists. |
