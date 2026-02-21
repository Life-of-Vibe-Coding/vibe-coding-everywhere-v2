const COMBINED_REGEX = /(?:(?:🖥\s*)?Running command:\n+`([^`]*)`)|(?:Output:\n```(?:[a-zA-Z0-9-]*)\n([\s\S]*?)\n```(?:\n+(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?)?)/g;
const STATUS_ONLY_REGEX = /^(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?\s*$/;

function parseCommandRunSegments(content) {
    const re = new RegExp(COMBINED_REGEX.source, "g");
    const segments = [];
    let lastEnd = 0;
    let m;

    let currentCommand = null;

    while ((m = re.exec(content)) !== null) {
        if (m.index > lastEnd) {
            const slice = content.slice(lastEnd, m.index).trim();
            const lines = slice.split(/\n/).map((l) => l.trim()).filter(Boolean);
            const isAllStatusLines = lines.length > 0 && lines.every((l) => STATUS_ONLY_REGEX.test(l));
            if (slice.length && !isAllStatusLines) {
                segments.push({ type: "markdown", content: slice });
            }
        }

        if (m[1] !== undefined) {
            currentCommand = {
                kind: "command",
                command: m[1],
                output: undefined,
                status: undefined,
                exitCode: undefined,
            };
            segments.push(currentCommand);
        } else if (m[2] !== undefined) {
            if (currentCommand) {
                currentCommand.output = m[2];
                currentCommand.status = m[3] || undefined;
                currentCommand.exitCode = m[4] != null ? parseInt(m[4], 10) : undefined;
            } else {
                segments.push({ type: "markdown", content: m[0] });
            }
        }
        lastEnd = m.index + m[0].length;
    }

    if (lastEnd < content.length) {
        const slice = content.slice(lastEnd).trim();
        const lines = slice.split(/\n/).map((l) => l.trim()).filter(Boolean);
        const isAllStatusLines = lines.length > 0 && lines.every((l) => STATUS_ONLY_REGEX.test(l));

        if (isAllStatusLines) {
            const statuses = lines
                .map((line) => {
                    const match = line.match(STATUS_ONLY_REGEX);
                    return match
                        ? { status: match[1], exitCode: match[2] != null ? parseInt(match[2], 10) : undefined }
                        : null;
                })
                .filter(Boolean);

            const cmdIndices = [];
            for (let i = segments.length - 1; i >= 0; i--) {
                if (segments[i].kind === "command") cmdIndices.unshift(i);
            }
            for (let i = 0; i < statuses.length && i < cmdIndices.length; i++) {
                const s = statuses[i];
                if (!s) continue;
                const cmd = segments[cmdIndices[i]];
                cmd.status = s.status;
                cmd.exitCode = s.exitCode;
            }
        } else if (slice.length) {
            segments.push({ type: "markdown", content: slice });
        }
    }

    return segments;
}

const text = `
Running command:

\`ls -la\`

Considering rendering start and inspecting shophub

Output:
\`\`\`
total 64
drwxr-xr-x@  5 yifanxu  staff    160 Feb 21 18:42 .
\`\`\`
-> Completed
`;

console.log(JSON.stringify(parseCommandRunSegments(text), null, 2));
