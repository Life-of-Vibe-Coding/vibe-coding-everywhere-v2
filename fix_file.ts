import * as fs from 'fs';
const content = fs.readFileSync('apps/mobile/src/components/file/WorkspaceSidebar.tsx', 'utf8');
console.log(content.split('\n').slice(630, 680).join('\n'));
