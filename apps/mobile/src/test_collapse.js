const BASH_COMMAND_BLOCK_REGEX = /(?:🖥\s*)?Running command:\n+`([^`]*)`(?:\n+Output:\n```\n([\s\S]*?)\n```)?(?:\n+(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?)?/g;

function getCommandBase(cmd) {
  const t = cmd.trim();
  const parts = t.split(/\s+/);
  if (parts.length <= 1) return t;
  return parts.slice(0, -1).join(" ");
}

function collapseIdenticalCommandSteps(content) {
  const blocks = [];
  let m;
  const re = new RegExp(BASH_COMMAND_BLOCK_REGEX.source, "g");
  while ((m = re.exec(content)) !== null) {
    blocks.push({ full: m[0], cmd: m[1] });
  }
  if (blocks.length < 2) return content;

  const keepIndex = new Set();
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

const text = `
Running command:

\`ls -la\`

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
...
\`\`\`
-> Completed
`;

console.log(collapseIdenticalCommandSteps(text));
