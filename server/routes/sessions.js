import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createSession, getSession, removeSession, subscribeToSession, unsubscribeFromSession } from "../sessionRegistry.js";
import { formatSessionLogTimestamp } from "../process/index.js";
import { getLlmCliIoTurnPaths } from "../config/index.js";
import { getProjectRoot } from "../config/index.js";

export function registerSessionsRoutes(app) {
    const router = Router();

    /** Extract canonical session UUID from filename stem (e.g. 2026-02-22T..._9176cf21-... -> 9176cf21-...) */
    function uuidFromFileStem(stem) {
        const idx = stem.lastIndexOf("_");
        return idx >= 0 ? stem.slice(idx + 1) : stem;
    }

    /** Map Pi CLI provider string to app provider (claude, gemini, pi). */
    function mapProvider(providerStr) {
        if (!providerStr || typeof providerStr !== "string") return null;
        const s = providerStr.toLowerCase();
        if (s.includes("gemini")) return "gemini";
        if (s.includes("claude") || s.includes("anthropic")) return "claude";
        if (s.includes("codex") || s.includes("openai")) return "pi";
        return null;
    }

    /** Parse JSONL to extract session id, first user input, and last model_change (provider, modelId). */
    function parseSessionMetadata(filePath) {
        let sessionId = null;
        let firstUserInput = null;
        let provider = null;
        let modelId = null;
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const lines = raw.split("\n").filter((l) => l.trim());
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    if (obj.type === "session" && typeof obj.id === "string") {
                        sessionId = obj.id;
                    }
                    if (obj.type === "model_change" && typeof obj.modelId === "string") {
                        provider = mapProvider(obj.provider) || provider;
                        modelId = obj.modelId;
                    }
                    if (obj.type === "message" && obj.message?.role === "user" && firstUserInput == null) {
                        const content = obj.message.content;
                        if (Array.isArray(content)) {
                            const textParts = content
                                .filter((c) => c?.type === "text" && typeof c.text === "string")
                                .map((c) => c.text);
                            firstUserInput = textParts.join("").trim().slice(0, 80) || null;
                        } else if (typeof content === "string") {
                            firstUserInput = content.trim().slice(0, 80) || null;
                        }
                        break; // found first user message
                    }
                } catch (_) {
                    /* skip malformed lines */
                }
            }
        } catch (e) {
            console.error("[sessions] Failed to parse metadata:", filePath, e?.message);
        }
        return { sessionId, firstUserInput, provider, modelId };
    }

    // GET /api/sessions - List PI-managed sessions from project root .pi/sessions
    router.get("/", (req, res) => {
        const root = getProjectRoot();
        const sessionDir = path.join(root, ".pi", "sessions");
        const discovered = [];
        try {
            if (fs.existsSync(sessionDir)) {
                const files = fs.readdirSync(sessionDir);
                for (const name of files) {
                    if (!name.endsWith(".jsonl")) continue;
                    const filePath = path.join(sessionDir, name);
                    const stat = fs.statSync(filePath);
                    const fileStem = name.replace(/\.jsonl$/, "");
                    const fileUuid = uuidFromFileStem(fileStem);
                    const { sessionId, firstUserInput, provider, modelId } = parseSessionMetadata(filePath);
                    const id = sessionId || fileUuid;
                    const activeSession = getSession(id) || getSession(fileUuid);
                    const sseConnected = activeSession ? activeSession.subscribers?.size > 0 : false;
                    const running = activeSession?.processManager?.processRunning?.() ?? false;
                    discovered.push({
                        id,
                        fileStem,
                        firstUserInput: firstUserInput || "(no input)",
                        provider: provider || null,
                        model: modelId || null,
                        mtime: stat.mtimeMs,
                        sseConnected,
                        running,
                    });
                }
                discovered.sort((a, b) => b.mtime - a.mtime);
            }
        } catch (e) {
            console.error("[sessions] Failed to list .pi/sessions:", e?.message);
        }
        res.json({ sessions: discovered, projectRootPath: root });
    });

    // POST /api/sessions
    // Submit prompt and create or update session.
    // Session is NOT created until first conversation (non-empty prompt) - "New session" stays empty.
    router.post("/", (req, res) => {
        const payload = req.body;
        const provider = payload.provider || "pi";
        const model = payload.model;
        const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";

        if (!prompt) {
            res.status(400).json({ ok: false, error: "Prompt cannot be empty" });
            return;
        }

        // Use temp ID for new sessions; Pi agent emits native session_id when conversation starts
        // and we migrate to that. Client can also pass sessionId for continuation.
        const sessionId = payload.sessionId || `temp-${crypto.randomUUID()}`;

        let session = getSession(sessionId);
        if (!session || payload.replaceRunning) {
            if (session) {
                removeSession(sessionId);
            }
            session = createSession(sessionId, provider, model);
            session.sessionLogTimestamp = formatSessionLogTimestamp();
        } else {
            // Update provider/model if changed
            session.provider = provider;
            session.model = model;
        }

        // Process manager logic
        try {
            session.processManager.handleSubmitPrompt(payload, req.headers.host);
            res.status(200).json({ sessionId, ok: true });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // POST /api/sessions/:sessionId/input
    router.post("/:sessionId/input", (req, res) => {
        const session = getSession(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        session.processManager.handleInput(req.body);
        res.json({ ok: true });
    });

    // POST /api/sessions/:sessionId/terminate
    router.post("/:sessionId/terminate", (req, res) => {
        const session = getSession(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        session.processManager.handleTerminate({ resetSession: req.body.resetSession });
        res.json({ ok: true });
    });

    // GET /api/sessions/:sessionId/messages - Load messages from project root .pi/sessions
    // sessionId can be UUID (9176cf21-...) or full file stem (2026-02-22T..._9176cf21-...)
    router.get("/:sessionId/messages", (req, res) => {
        const { sessionId } = req.params;
        const root = getProjectRoot();
        const sessionDir = path.join(root, ".pi", "sessions");
        let filePath = path.join(sessionDir, `${sessionId}.jsonl`);
        if (!fs.existsSync(filePath)) {
            // Try match by UUID: find file *_{uuid}.jsonl
            const files = fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir) : [];
            const match = files.find((n) => n.endsWith(`_${sessionId}.jsonl`));
            if (match) filePath = path.join(sessionDir, match);
        }
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Session not found" });
        }
        const canonicalSessionId = uuidFromFileStem(path.basename(filePath, ".jsonl"));
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const lines = raw.split("\n").filter((l) => l.trim());

            /** Extract content from Pi message content array. Thinking uses c.thinking, text uses c.text. */
            function extractMessageContent(contentArr) {
                if (!Array.isArray(contentArr)) return "";
                return contentArr
                    .filter((c) => c && (c.type === "text" || c.type === "thinking"))
                    .map((c) => {
                        if (c.type === "thinking" && typeof c.thinking === "string") return `<think>\n${c.thinking}\n</think>\n\n`;
                        if (c.type === "text" && typeof c.text === "string") return c.text;
                        return "";
                    })
                    .filter(Boolean)
                    .join("");
            }

            const messages = [];
            let idx = 0;
            let pendingAssistantContent = [];

            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    if (obj.type !== "message" || !obj.message) continue;
                    const m = obj.message;
                    const role = m.role;
                    if (role !== "user" && role !== "assistant") continue;

                    const content = extractMessageContent(m.content).trim();
                    if (!content) continue;

                    if (role === "user") {
                        if (pendingAssistantContent.length > 0) {
                            messages.push({
                                id: `msg-${++idx}`,
                                role: "assistant",
                                content: pendingAssistantContent.join("\n\n").trim(),
                            });
                            pendingAssistantContent = [];
                        }
                        messages.push({ id: `msg-${++idx}`, role: "user", content });
                    } else {
                        pendingAssistantContent.push(content);
                    }
                } catch (_) {
                    /* skip malformed lines */
                }
            }
            if (pendingAssistantContent.length > 0) {
                messages.push({
                    id: `msg-${++idx}`,
                    role: "assistant",
                    content: pendingAssistantContent.join("\n\n").trim(),
                });
            }
            const { provider, modelId } = parseSessionMetadata(filePath);
            res.json({ messages, sessionId: canonicalSessionId, provider: provider || null, model: modelId || null });
        } catch (e) {
            console.error("[sessions] Failed to load messages:", e?.message);
            res.status(500).json({ error: "Failed to load session" });
        }
    });

    // DELETE /api/sessions/:sessionId - Remove .pi/sessions file and optionally clean up active registry
    router.delete("/:sessionId", (req, res) => {
        const { sessionId } = req.params;
        const root = getProjectRoot();
        const sessionDir = path.join(root, ".pi", "sessions");
        let filePath = path.join(sessionDir, `${sessionId}.jsonl`);
        if (!fs.existsSync(filePath)) {
            const files = fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir) : [];
            const match = files.find((n) => n.endsWith(`_${sessionId}.jsonl`));
            if (match) filePath = path.join(sessionDir, match);
        }
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Session not found" });
        }
        try {
            const activeSession = getSession(sessionId);
            if (activeSession) {
                removeSession(sessionId);
            }
            fs.unlinkSync(filePath);
            res.json({ ok: true });
        } catch (e) {
            console.error("[sessions] Failed to delete session file:", filePath, e?.message);
            res.status(500).json({ error: "Failed to delete session" });
        }
    });

    // GET /api/sessions/:sessionId/stream
    router.get("/:sessionId/stream", async (req, res) => {
        const sessionId = req.params.sessionId;
        const session = getSession(sessionId);

        // Setup SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        if (!session) {
            res.write(`event: end\ndata: {"exitCode": 1, "error": "Session not found"}\n\n`);
            res.end();
            return;
        }

        const activeOnly = req.query.activeOnly === "1" || req.query.activeOnly === "true";
        const turnCounter = session.processManager.getTurnCounter?.() || 1;
        const processRunning = session.processManager.processRunning?.() || false;
        let startTurn = 1;
        if (activeOnly) {
            startTurn = processRunning ? turnCounter : (turnCounter + 1);
        }
        let sentLines = 0;
        for (let i = startTurn; i <= turnCounter; i++) {
            try {
                const { outputPath } = getLlmCliIoTurnPaths("pi", session.sessionLogTimestamp, i);
                if (fs.existsSync(outputPath)) {
                    const logs = fs.readFileSync(outputPath, "utf-8");
                    const lines = logs.split("\n");
                    for (const line of lines) {
                        if (line.trim()) {
                            res.write(`data: ${line}\n\n`);
                            sentLines++;
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to read log history", e);
            }
        }
        console.log(`[SSE] sessionId=${sessionId} connected. Sent ${sentLines} lines of history.`);

        // Subscribe to live events
        subscribeToSession(sessionId, res);
        if (process.env.DEBUG_SSE) {
            console.log(`[SSE] subscribed sessionId=${sessionId}, total subscribers=${session.subscribers.size}`);
        }

        req.on("close", () => {
            // Use session ref directly (survives migrate to Pi's native session_id)
            session.subscribers.delete(res);
        });
    });

    app.use("/api/sessions", router);
}
