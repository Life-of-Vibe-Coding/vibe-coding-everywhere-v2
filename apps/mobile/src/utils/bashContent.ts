/**
 * Bash/code block parsing utilities for chat message content.
 * Handles empty bash blocks, command extraction, and command step collapsing.
 */

/** Lines that are prose/headings, not runnable shell commands. */
const NON_COMMAND_LINE_REGEX =
  /^\s*(#{2,}\s+.*|\*\*[^*]*\*\*\s*$|Command\s+execution\s+summary\s*$|Full\s+command\s+chain\s*\(.*\)\s*$|Terminal\s+\d+:\s*.*)$/i;

/** Match "Terminal N: ..." section headers. */
export const TERMINAL_HEADER_LINE_REGEX = /^\s*Terminal\s+\d+:\s*.+$/i;

/** Opening fence for bash-like blocks (bash, sh, shell, zsh). */
const BASH_FENCE_OPEN = /^```(bash|sh|shell|zsh)\s*$/im;

/** Matches "Running command:" or "🖥 Running command:" followed by command and optional output. */
const BASH_COMMAND_BLOCK_REGEX = /(?:🖥\s*)?Running command:(?:\r?\n)+`([^`]*)`(?:(?:\r?\n)+Output:\r?\n```(?:[a-zA-Z0-9-]*)\r?\n([\s\S]*?)\r?\n```)?(?:(?:\r?\n)+(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?)?/;

function looksLikeProse(trimmed: string): boolean {
  if (!trimmed) return false;
  return trimmed.endsWith(".");
}

function getCommandBase(cmd: string): string {
  const t = cmd.trim();
  const parts = t.split(/\s+/);
  if (parts.length <= 1) return t;
  return parts.slice(0, -1).join(" ");
}

/**
 * If the model outputs an empty bash code block and the commands as plain text below,
 * moves the following command-like lines into the block so they render inside it.
 */
export function fillEmptyBashBlocks(content: string): string {
  if (!content || typeof content !== "string") return content;
  const openMatch = content.match(BASH_FENCE_OPEN);
  if (!openMatch) return content;
  const openStart = content.indexOf(openMatch[0]);
  const openEnd = openStart + openMatch[0].length;
  const afterOpen = content.slice(openEnd);
  let closeIdx = afterOpen.search(/\r?\n```/);
  if (closeIdx === -1) {
    const bareClose = afterOpen.match(/^```/);
    if (bareClose) {
      closeIdx = 0;
    } else {
      return content;
    }
  }
  const blockBody = afterOpen.slice(0, closeIdx).trim();
  if (blockBody.length > 0) return content;
  const closeMatch = afterOpen.slice(closeIdx).match(/^(\r?\n)?```/);
  const closeFenceLen = closeMatch ? closeMatch[0].length : 4;
  const afterClose = afterOpen.slice(closeIdx + closeFenceLen).replace(/^\s*\r?\n?/, "");
  const lines = afterClose.split(/\r?\n/);
  const commandLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith("```")) break;
    if (!t) {
      if (commandLines.length > 0) commandLines.push(line);
      continue;
    }
    const isNonCommand = NON_COMMAND_LINE_REGEX.test(t) || looksLikeProse(t);
    if (isNonCommand && commandLines.length > 0) break;
    if (!isNonCommand) commandLines.push(line);
  }
  let linesToFill = commandLines;
  let beforeBlock = content.slice(0, openStart);
  let rest = "";
  if (commandLines.length === 0) {
    const beforeLines = beforeBlock.split(/\r?\n/);
    const trailingCommands: string[] = [];
    let firstTakenIndex = beforeLines.length;
    for (let i = beforeLines.length - 1; i >= 0; i--) {
      const line = beforeLines[i];
      const t = line.trim();
      if (!t) {
        if (trailingCommands.length > 0) trailingCommands.unshift(line);
        continue;
      }
      if (t.startsWith("```") || NON_COMMAND_LINE_REGEX.test(t) || looksLikeProse(t)) {
        firstTakenIndex = i + 1;
        break;
      }
      firstTakenIndex = i;
      trailingCommands.unshift(line);
    }
    if (trailingCommands.length === 0) return content;
    linesToFill = trailingCommands;
    beforeBlock = beforeLines.slice(0, firstTakenIndex).join("\n").replace(/\n+$/, "");
    if (beforeBlock.length > 0) beforeBlock = beforeBlock + "\n\n";
    else beforeBlock = "";
  } else {
    const restLines = lines.slice(commandLines.length);
    rest = restLines.join("\n").replace(/^\s*\n?/, "");
  }
  const lang = (openMatch[1] ?? "bash").toLowerCase();
  const filledBlock = "```" + lang + "\n" + linesToFill.join("\n").trimEnd() + "\n```";
  return beforeBlock + filledBlock + (rest ? "\n\n" + rest : "");
}

/** Remove trailing "Terminal N: ..." lines from code block content. */
export function stripTrailingTerminalHeaderLines(content: string): string {
  const lines = content.split(/\r?\n/);
  let last = lines.length;
  while (last > 0 && TERMINAL_HEADER_LINE_REGEX.test(lines[last - 1]?.trim() ?? "")) last--;
  return lines.slice(0, last).join("\n").trimEnd();
}

/**
 * Extract runnable command only from a bash code block that may contain mixed content
 * (headings, "Command execution summary", or build-output prose).
 */
export function extractBashCommandOnly(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const commandLines: string[] = [];
  let started = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (started) commandLines.push(line);
      continue;
    }
    const isNonCommand = NON_COMMAND_LINE_REGEX.test(t) || looksLikeProse(t);
    if (!started) {
      if (!isNonCommand) started = true;
      else continue;
    }
    if (isNonCommand) break;
    commandLines.push(line);
  }
  return commandLines.join("\n").trim();
}

/** Collapse consecutive identical command steps to show only the last one. */
export function collapseIdenticalCommandSteps(content: string): string {
  const blocks: Array<{ full: string; cmd: string }> = [];
  let m;
  const re = new RegExp(BASH_COMMAND_BLOCK_REGEX.source, "g");
  while ((m = re.exec(content)) !== null) {
    blocks.push({ full: m[0], cmd: m[1] });
  }
  if (blocks.length < 2) return content;

  const keepIndex = new Set<number>();
  let i = 0;
  while (i < blocks.length) {
    const base = getCommandBase(blocks[i].cmd);
    let j = i + 1;
    while (j < blocks.length && getCommandBase(blocks[j].cmd) === base) j++;
    keepIndex.add(j - 1);
    i = j;
  }

  let idx = 0;
  const collapsed = content.replace(re, (match) => (keepIndex.has(idx++) ? match : ""));
  return collapsed.replace(/\n{4,}/g, "\n\n\n");
}
