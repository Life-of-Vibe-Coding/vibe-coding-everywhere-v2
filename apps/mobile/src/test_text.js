const BASH_COMMAND_BLOCK_REGEX = /(?:🖥\s*)?Running command:\n+`([^`]*)`(?:\n+Output:\n```\n([\s\S]*?)\n```)?(?:\n+(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?)?/g;
const fs = require('fs');

const text = `
<think>
Running command:

\`ls -la\`
</think>

<think>
Output:
\`\`\`
total 64
drwxr-xr-x@  5 yifanxu  staff    160 Feb 21 18:42 .
\`\`\`
-> Completed
</think>
`;

const stripped = text.replace(/<think>/g, "").replace(/<\/think>/g, "").trim();
console.log([...stripped.matchAll(BASH_COMMAND_BLOCK_REGEX)]);
