# Systematic Debug: Why terminal-runner Is Not Discovered by Agent

## Phase 1: Root Cause Investigation

### 1. Symptom

Agent lists only 3 skills (ui-ux-pro-max, enhance-prompt, senior-fullstack-engineer) when asked about capabilities. `terminal-runner` is enabled in settings and appears in `/api/skills-enabled` but is **not** listed by the agent.

### 2. Evidence Gathered

| Layer | Check | Result |
|-------|-------|--------|
| API `/api/skills` | Does terminal-runner exist in skills catalog? | ✓ Yes |
| API `/api/skills-enabled` | Is terminal-runner in enabledIds? | ✓ Yes |
| `skills-enabled.json` | Project `.pi/agent/skills-enabled.json` | ✓ Contains terminal-runner |
| `.pi/skills-enabled/` symlinks | Workspace symlinks | ✓ All 4 skills including terminal-runner |
| `resolveAgentDir` | Workspace has no `.pi/agent`; project root has it | ✓ Uses project `.pi/agent` |
| `syncEnabledSkillsFolder` | Returns paths for --skill flags | ✓ Should return 4 paths |

### 3. Root Cause

**Pi receives skills via `--skill` flags**, and `syncEnabledSkillsFolder` correctly creates symlinks for all 4 skills. However, **`getSkillsRoster` is never injected** into the Pi system prompt. The roster explicitly tells the agent: "Your available skills are ONLY the following (enabled). When asked about your capabilities or skills, list ONLY these." Without it, the agent infers skills from raw SKILL.md content only, and the LLM may omit skills when summarizing.

### 4. Fix

Inject `getSkillsRoster(skillsDir, agentDir)` as an `--append-system-prompt` so the agent has an authoritative list of enabled skills. This guarantees terminal-runner (and all enabled skills) are explicitly surfaced when the agent reports capabilities.

---

## Verification

After fix: Restart server, start new Pi session, ask "what skills can you use?" — terminal-runner must appear in the list.
