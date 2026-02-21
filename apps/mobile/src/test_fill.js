const BASH_FENCE_OPEN = /```(\w+)?\r?\n/;
const NON_COMMAND_LINE_REGEX = /^(?:#|\/\/|\/\*|<!--|\{|}|\s*$)/;
function looksLikeProse(line) {
  if (/^[A-Z][a-z]/.test(line)) return true;
  if (/^[^a-zA-Z]*$/.test(line)) return false;
  if (!/(?:^|\s)(?:npm|yarn|pnpm|bun|npx|cd|ls|echo|cat|grep|git)(?:\s|$)/.test(line)) {
    if (line.split(/\s+/).length > 3) return true;
  }
  return false;
}

function fillEmptyBashBlocks(content) {
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
  const commandLines = [];
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
    return content; // Simplified for test
  } else {
    const restLines = lines.slice(commandLines.length);
    rest = restLines.join("\n").replace(/^\s*\n?/, "");
  }
  const lang = (openMatch[1] ?? "bash").toLowerCase();
  const filledBlock = "```" + lang + "\n" + linesToFill.join("\n").trimEnd() + "\n```";
  return beforeBlock + filledBlock + (rest ? "\n\n" + rest : "");
}

let content = `
Running command:

\`ls\`

Output:
\`\`\`
index.html
shophub
\`\`\`
-> Completed

Considering rendering start and inspecting shophub

Running command:

\`ls shophub\`

Output:
\`\`\`
package.json
src
\`\`\`
-> Completed
`;

for(let i=0; i<8; i++) {
  let next = fillEmptyBashBlocks(content);
  if(next === content) break;
  content = next;
}
console.log(content);
