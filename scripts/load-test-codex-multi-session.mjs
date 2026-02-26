#!/usr/bin/env node
/**
 * Load Test: 5 Long Questions → Codex 5.2 in Separate Concurrent Sessions
 *
 * Fires 5 detailed "explain the code" prompts to gpt-5.2-codex simultaneously,
 * each in its own session, to stress-test multi-session concurrency.
 *
 * What it tests:
 * - 5 concurrent Pi RPC sessions running at the same time
 * - Each session receives only its own output (no cross-talk)
 * - All sessions complete with exit events
 * - Background streaming works for all sessions
 *
 * Usage:
 *   # Start server first:
 *   npm run dev
 *
 *   # Then run the load test:
 *   node scripts/load-test-codex-multi-session.mjs
 *
 *   # Override model (e.g. codex-mini):
 *   CODEX_MODEL=gpt-5.1-codex-mini node scripts/load-test-codex-multi-session.mjs
 *
 *   # Override server URL:
 *   SERVER_URL=http://192.168.1.100:3456 node scripts/load-test-codex-multi-session.mjs
 *
 *   # Adjust timeout (default 10 min):
 *   TIMEOUT_MS=900000 node scripts/load-test-codex-multi-session.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { EventSource } = require("eventsource");

// ── Configuration ──────────────────────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3456";
const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5.2-codex";
const PROVIDER = "codex";
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "600000", 10); // 10 min default
const STAGGER_MS = parseInt(process.env.STAGGER_MS || "1000", 10); // stagger start by 1s
const CWD = process.env.CWD_PROJECT || "/Users/yifanxu/machine_learning/LoVC/vibe-coding-everywhere_v3";

// ── 5 Long "Explain the Code" Prompts ──────────────────────────────────────
const PROMPTS = [
    {
        label: "Q1-ServerArchitecture",
        prompt: `Examine the entire server/ directory in this project. I want an extremely detailed explanation of the server architecture. Specifically:
1. Walk through every file in server/ and server/routes/ — explain what each file does, its exports, and how it connects to the main server.js entry point.
2. Explain the session management system: how sessions are created, stored on disk as JSONL files, discovered on startup, and streamed via SSE.
3. Describe the Pi RPC process lifecycle — how piRpcSession.js spawns the Pi CLI, handles stdin/stdout JSON-RPC communication, and manages turn-based conversation flow.
4. Explain the proxy.js module and how it handles request forwarding.
5. Detail all environment variables and configuration options from server/config/index.js and how they affect behavior.
6. Describe error handling patterns, graceful shutdown, and process cleanup across the server codebase.
Be as thorough as possible — include code references, function signatures, and data flow diagrams in your explanation. In your final reply, include this exact verification token: {TOKEN}`,
    },
    {
        label: "Q2-MobileAppServices",
        prompt: `Analyze the apps/mobile/src/services/ directory comprehensively. I need a deep-dive explanation covering:
1. List every service file and module — explain the purpose of each, its public API, and internal implementation details.
2. Focus on the chat/ subdirectory: explain how chat sessions are managed client-side, how SSE connections are established and maintained, and how messages flow from user input to server and back.
3. Explain the sessionCacheHelpers — what caching strategy is used, how cache eviction works, and how sessions persist across app restarts.
4. Detail any API client utilities — how HTTP requests are constructed, error handling, retry logic, and authentication flow.
5. Walk through any state management patterns — React hooks, context providers, or stores used by the services layer.
6. Explain how the mobile app handles offline scenarios, reconnection, and session recovery.
7. Describe the relationship between the services layer and the UI components that consume them.
Include specific function names, type signatures, and data flow explanations. In your final reply, include this exact verification token: {TOKEN}`,
    },
    {
        label: "Q3-ComponentArchitecture",
        prompt: `Perform a comprehensive analysis of the apps/mobile/src/components/ directory. I want an exhaustive explanation of the component architecture:
1. List all top-level component directories and files — explain the purpose and responsibility of each component group.
2. For the chat-related components, explain the full rendering pipeline: how messages are displayed, how streaming SSE data is rendered in real-time, auto-scroll behavior, and message formatting (markdown, code blocks, etc.).
3. Analyze the file/ components — workspace sidebar, file tree, commit display — explain how they integrate with the backend file system APIs.
4. Detail the navigation structure: how screens are organized, routing patterns, tab navigation, and deep linking if present.
5. Explain the theming system: how dark/light mode works, color tokens, typography, spacing, and how themes are applied across components.
6. Walk through any animation patterns: entrance animations, transitions, gesture handlers, and performance optimization techniques.
7. Describe the modal system and how overlay components (process dashboard, workspace picker, etc.) are managed.
8. Identify any shared utilities, custom hooks, or higher-order components that cross-cut the component tree.
Be extremely detailed with code references and component hierarchy diagrams. In your final reply, include this exact verification token: {TOKEN}`,
    },
    {
        label: "Q4-BuildAndConfig",
        prompt: `Analyze the entire build system, configuration, and project infrastructure. I need an exhaustive explanation covering:
1. Walk through package.json at the root AND apps/mobile/package.json — explain every script, dependency, and devDependency. What does each package do and why is it included?
2. Explain the monorepo structure: how the root package.json relates to apps/mobile, any workspace configuration (npm/yarn workspaces), and how dependencies are hoisted.
3. Detail the TypeScript configuration: tsconfig.json files, path aliases, compiler options, and how they differ between environments (dev, build, test).
4. Analyze Expo configuration: app.json, metro.config.js, babel.config, and any native build configurations. Explain how EAS Build works if configured.
5. Walk through the jest.config: test setup, module name mapping, transform configuration, and test file patterns.
6. Explain any CI/CD configuration, linting (ESLint), formatting (Prettier), and code quality tools.
7. Detail the .env and .env.example files — all environment variables, their purposes, and how they flow from server to mobile app.
8. Analyze the scripts/ directory: what each script does, when to use them, and how they integrate with the development workflow.
9. Explain the docker/ directory and any containerization setup.
Be comprehensive and include specific configuration values and their effects. In your final reply, include this exact verification token: {TOKEN}`,
    },
    {
        label: "Q5-SkillsAndExtensions",
        prompt: `Analyze the skills/ directory and the entire skill/extension system in this project. I want a comprehensive explanation covering:
1. List every skill directory and explain what each skill does — its purpose, how it's activated, and what capabilities it provides.
2. Explain the skill loading mechanism: how skills are discovered from the skills/ folder, how they're synced to .pi/skills-enabled, and how the server registers them with the Pi CLI via --skill flags.
3. Detail the skill configuration format: what files each skill contains (SKILL.md, scripts/, examples/, resources/), the YAML frontmatter schema, and how instructions are structured.
4. Analyze the skills-lock.json file — what it tracks, how it's updated, and its role in skill version management.
5. Walk through the server/skills/index.js module — explain syncEnabledSkillsFolder, resolveAgentDir, and how symlinks are managed.
6. Explain how skills interact with the Pi agent at runtime — how skill instructions are injected into the system prompt, how tool definitions are registered, and how the agent invokes skill capabilities.
7. Describe the .agents/skills/ directory in the mobile app — how it differs from the server skills, and any skill-specific configurations.
8. Analyze at least 3 specific skills in depth (e.g. terminal-runner, better-icons, nanobanana) — explain their implementation, MCP server integration if applicable, and usage patterns.
9. Explain how new skills can be created, tested, and deployed.
Include specific file paths, function signatures, and configuration examples. In your final reply, include this exact verification token: {TOKEN}`,
    },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractText(parsed) {
    if (!parsed || typeof parsed !== "object") return "";
    if (parsed.assistantMessageEvent?.delta)
        return parsed.assistantMessageEvent.delta;
    if (parsed.assistantMessageEvent?.content)
        return String(parsed.assistantMessageEvent.content ?? "");
    if (parsed.result?.content) {
        const arr = Array.isArray(parsed.result.content)
            ? parsed.result.content
            : [];
        return arr
            .map((c) => c?.text ?? "")
            .filter(Boolean)
            .join("");
    }
    if (parsed.type === "message" && parsed.message?.content) {
        const arr = Array.isArray(parsed.message.content)
            ? parsed.message.content
            : [];
        return arr
            .filter((c) => c?.type === "text" && typeof c.text === "string")
            .map((c) => c.text)
            .join("");
    }
    return "";
}

async function setWorkspace(cwd) {
    const res = await fetch(`${SERVER_URL}/api/workspace-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: cwd }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /api/workspace-path failed ${res.status}: ${text}`);
    }
}

async function submitPrompt(sessionId, provider, model, prompt) {
    const res = await fetch(`${SERVER_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, provider, model, prompt }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /api/sessions failed ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Submit failed");
    return json.sessionId;
}

/**
 * Create SSE collector for a session. Returns { promise, liveState }.
 */
function createSseCollector(sessionId, token, label) {
    const liveState = {
        fullOutputLength: 0,
        startTime: Date.now(),
        firstChunkTime: null,
        events: 0,
    };

    const promise = new Promise((resolve) => {
        let fullOutput = "";
        let exitCode = null;
        let outputBuffer = "";
        let resolved = false;

        const url = `${SERVER_URL}/api/sessions/${encodeURIComponent(
            sessionId
        )}/stream`;
        const es = new EventSource(url);

        const finish = (err) => {
            if (resolved) return;
            resolved = true;
            try {
                es.close();
            } catch (_) { }
            resolve({
                label,
                token,
                fullOutput,
                exitCode,
                error: err,
                sessionId,
                stats: {
                    totalTimeMs: Date.now() - liveState.startTime,
                    timeToFirstChunkMs: liveState.firstChunkTime
                        ? liveState.firstChunkTime - liveState.startTime
                        : null,
                    totalEvents: liveState.events,
                    outputLength: fullOutput.length,
                },
            });
        };

        const timeout = setTimeout(() => {
            finish(`Timeout after ${TIMEOUT_MS / 1000}s`);
        }, TIMEOUT_MS);

        es.onmessage = (ev) => {
            const str =
                typeof ev.data === "string" ? ev.data : String(ev.data ?? "");
            outputBuffer += str + "\n";
            const lines = outputBuffer.split("\n");
            outputBuffer = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                liveState.events++;
                if (!liveState.firstChunkTime) liveState.firstChunkTime = Date.now();
                try {
                    const parsed = JSON.parse(trimmed);
                    const text = extractText(parsed);
                    if (text) fullOutput += text;
                } catch {
                    fullOutput += trimmed + "\n";
                }
            }
            liveState.fullOutputLength = fullOutput.length;
        };

        es.addEventListener("end", (ev) => {
            try {
                const data = ev.data ? JSON.parse(ev.data) : {};
                exitCode = data.exitCode ?? 0;
            } catch (_) { }
            clearTimeout(timeout);
            finish();
        });

        es.onerror = () => {
            if (!resolved) {
                clearTimeout(timeout);
                finish("SSE connection error");
            }
        };
    });
    return { promise, liveState };
}

// ── Progress Reporter ───────────────────────────────────────────────────────

function startProgressReporter(liveStates, labels) {
    const interval = setInterval(() => {
        const progress = liveStates
            .map(
                (s, i) =>
                    `${labels[i]}: ${(s.fullOutputLength / 1024).toFixed(1)}KB (${s.events} events)`
            )
            .join(" | ");
        console.error(`[progress] ${progress}`);
    }, 5000); // report every 5s

    return () => clearInterval(interval);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.error("╔════════════════════════════════════════════════════════════╗");
    console.error("║  LOAD TEST: 5 Long Questions → Codex in 5 Sessions       ║");
    console.error("╚════════════════════════════════════════════════════════════╝");
    console.error(`  Server:   ${SERVER_URL}`);
    console.error(`  Model:    ${CODEX_MODEL}`);
    console.error(`  Provider: ${PROVIDER}`);
    console.error(`  Timeout:  ${TIMEOUT_MS / 1000}s per session`);
    console.error(`  Stagger:  ${STAGGER_MS}ms between session starts`);
    console.error(`  CWD:      ${CWD}`);
    console.error("");

    // Set workspace once
    try {
        await setWorkspace(CWD);
        console.error(`[setup] Workspace set to: ${CWD}`);
    } catch (err) {
        console.error(`[setup] WARNING: Failed to set workspace: ${err.message}`);
    }

    const collectors = [];
    const liveStates = [];
    const labels = [];
    const sessionTokens = [];
    const startTime = Date.now();

    // Fire all 5 sessions with slight stagger
    for (let i = 0; i < PROMPTS.length; i++) {
        const cfg = PROMPTS[i];
        const sessionId = `load-test-${i}-${crypto.randomUUID()}`;
        const token = `LOADTEST_${i}_${Date.now()}`;
        const prompt = cfg.prompt.replace("{TOKEN}", token);

        labels.push(cfg.label);
        sessionTokens.push(token);

        console.error(
            `[${cfg.label}] Submitting... (session: ${sessionId.slice(0, 20)}...)`
        );

        try {
            await submitPrompt(sessionId, PROVIDER, CODEX_MODEL, prompt);
            console.error(`[${cfg.label}] ✓ Submitted`);
        } catch (err) {
            console.error(`[${cfg.label}] ✗ Submit FAILED: ${err.message}`);
            collectors.push(
                Promise.resolve({
                    label: cfg.label,
                    token,
                    fullOutput: "",
                    exitCode: null,
                    error: `Submit failed: ${err.message}`,
                    sessionId,
                    stats: { totalTimeMs: 0, timeToFirstChunkMs: null, totalEvents: 0, outputLength: 0 },
                })
            );
            liveStates.push({ fullOutputLength: 0, events: 0 });
            continue;
        }

        const { promise, liveState } = createSseCollector(sessionId, token, cfg.label);
        collectors.push(promise);
        liveStates.push(liveState);

        // Stagger next session start
        if (i < PROMPTS.length - 1 && STAGGER_MS > 0) {
            await new Promise((r) => setTimeout(r, STAGGER_MS));
        }
    }

    console.error("");
    console.error(
        `[load-test] All ${collectors.length} sessions launched. Waiting for completion...`
    );
    console.error(`[load-test] Progress updates every 5 seconds:\n`);

    // Start progress reporter
    const stopProgress = startProgressReporter(liveStates, labels);

    // Wait for all to complete
    const results = await Promise.all(collectors);
    stopProgress();

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // ── Results Report ──────────────────────────────────────────────────────
    console.error("\n╔════════════════════════════════════════════════════════════╗");
    console.error("║                    RESULTS SUMMARY                       ║");
    console.error("╚════════════════════════════════════════════════════════════╝\n");

    let allPassed = true;
    const allTokens = results.map((r) => r.token).filter(Boolean);

    for (const r of results) {
        const hasOwnToken = r.token && r.fullOutput.includes(r.token);
        const hasCrossTalk = allTokens.some(
            (t) => t !== r.token && r.fullOutput.includes(t)
        );
        const gotExit = r.exitCode !== null;
        const noError = !r.error;
        const hasContent = r.fullOutput.length > 100;

        const ok = noError && gotExit && hasContent && !hasCrossTalk;
        if (!ok) allPassed = false;

        const status = ok ? "✅ PASS" : "❌ FAIL";
        const s = r.stats;

        console.error(`  ${status}  ${r.label}`);
        console.error(
            `         Time: ${(s.totalTimeMs / 1000).toFixed(1)}s | TTFC: ${s.timeToFirstChunkMs ? (s.timeToFirstChunkMs / 1000).toFixed(1) + "s" : "N/A"} | Events: ${s.totalEvents} | Output: ${(s.outputLength / 1024).toFixed(1)}KB`
        );

        if (r.error) console.error(`         Error: ${r.error}`);
        if (hasCrossTalk) console.error(`         ⚠️  CROSS-TALK detected!`);
        if (!gotExit) console.error(`         ⚠️  No exit event received`);
        if (!hasContent)
            console.error(
                `         ⚠️  Output too short (${r.fullOutput.length} chars)`
            );
        if (hasOwnToken) console.error(`         ✓ Verification token found`);
        else console.error(`         ○ Verification token not found (optional)`);

        // Output preview
        const preview = r.fullOutput
            .slice(0, 120)
            .replace(/\n/g, " ")
            .trim();
        if (preview) console.error(`         Preview: "${preview}..."`);
        console.error("");
    }

    // ── Aggregate Stats ──────────────────────────────────────────────────────
    const successCount = results.filter((r) => !r.error && r.exitCode !== null).length;
    const totalOutput = results.reduce((sum, r) => sum + (r.stats?.outputLength ?? 0), 0);
    const totalEvents = results.reduce((sum, r) => sum + (r.stats?.totalEvents ?? 0), 0);
    const avgTime = results.filter((r) => r.stats?.totalTimeMs > 0).length > 0
        ? (results.reduce((sum, r) => sum + (r.stats?.totalTimeMs ?? 0), 0) /
            results.filter((r) => r.stats?.totalTimeMs > 0).length / 1000).toFixed(1)
        : "N/A";

    console.error("─────────────────────────────────────────────────────────────");
    console.error(`  Total elapsed:      ${totalElapsed}s (wall clock)`);
    console.error(`  Sessions:           ${successCount}/${results.length} completed`);
    console.error(`  Avg session time:   ${avgTime}s`);
    console.error(`  Total output:       ${(totalOutput / 1024).toFixed(1)}KB`);
    console.error(`  Total SSE events:   ${totalEvents}`);
    console.error(`  Model:              ${CODEX_MODEL}`);
    console.error("─────────────────────────────────────────────────────────────\n");

    if (allPassed) {
        console.error("🎉 LOAD TEST PASSED — All 5 sessions completed successfully.");
        console.error("   Multi-session concurrency with Codex is working correctly.\n");
        process.exit(0);
    } else {
        console.error("⚠️  LOAD TEST HAD FAILURES — Check individual results above.\n");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("[load-test] Fatal error:", err);
    process.exit(1);
});
