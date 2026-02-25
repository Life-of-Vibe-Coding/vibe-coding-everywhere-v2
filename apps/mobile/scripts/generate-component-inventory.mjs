#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const mobileRoot = fs.existsSync(path.join(repoRoot, 'App.tsx')) ? repoRoot : path.join(repoRoot, 'apps/mobile');
const componentsRoot = path.join(mobileRoot, 'src/components');
const outputCsvPath = path.join(mobileRoot, 'docs/gluestack-migration-phase1-inventory.csv');
const outputMdPath = path.join(mobileRoot, 'docs/gluestack-migration-phase1-priority-matrix.md');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function classifyRisk(rel) {
  const topLevel = rel.split('/')[0];
  if (['chat', 'file', 'preview', 'processes', 'docker'].includes(topLevel)) return 'high';
  if (['settings', 'pages', 'common', 'components'].includes(topLevel)) return 'medium';
  return 'n/a';
}

function classifyPhase(risk) {
  if (risk === 'high') return 'P3-high-critical-paths';
  if (risk === 'medium') return 'P2-medium-composition';
  return 'P1-non-ui-logic';
}

const files = walk(componentsRoot)
  .filter((abs) => /\.(ts|tsx)$/.test(abs))
  .map((abs) => path.relative(componentsRoot, abs).replace(/\\/g, '/'))
  .filter((rel) => !rel.startsWith('ui/'))
  .filter((rel) => !rel.includes('/__tests__/') && !rel.endsWith('.test.ts') && !rel.endsWith('.test.tsx'))
  .sort();

const rows = [];
const byRisk = { high: 0, medium: 0, low: 0, 'n/a': 0 };

for (const rel of files) {
  const abs = path.join(componentsRoot, rel);
  const content = fs.readFileSync(abs, 'utf8');
  const rnImportCount = (content.match(/from\s+['"]react-native['"]/g) || []).length;
  const uiImportCount = (content.match(/from\s+['"]@\/components\/ui\//g) || []).length;
  const risk = classifyRisk(rel);
  byRisk[risk] = (byRisk[risk] || 0) + 1;
  rows.push({
    component: `apps/mobile/src/components/${rel}`,
    module: rel,
    rn_import_count: rnImportCount,
    ui_import_count: uiImportCount,
    risk,
    migration_phase: classifyPhase(risk),
    status: 'todo',
  });
}

const header = ['component', 'module', 'rn_import_count', 'ui_import_count', 'risk', 'migration_phase', 'status'];
const csv = [
  header.join(','),
  ...rows.map((row) => header.map((k) => row[k]).join(',')),
].join('\n') + '\n';

fs.mkdirSync(path.dirname(outputCsvPath), { recursive: true });
fs.writeFileSync(outputCsvPath, csv);

const md = `# Gluestack Migration: Phase 1 Priority Matrix (Live)\n\n` +
  `Generated from current \`src/components\` tree.\n\n` +
  `## Coverage\n` +
  `- Total component modules (excluding \`ui/*\` and tests): ${rows.length}\n` +
  `- High risk: ${byRisk.high}\n` +
  `- Medium risk: ${byRisk.medium}\n` +
  `- Low risk: ${byRisk.low}\n` +
  `- Non-UI/logic (\`n/a\`): ${byRisk['n/a']}\n\n` +
  `## Notes\n` +
  `- Inventory is generated from live files; deleted modules are automatically excluded.\n` +
  `- Use \`npm run -w mobile inventory:components\` to refresh after refactors.\n`;

fs.writeFileSync(outputMdPath, md);

console.log(`Wrote ${path.relative(repoRoot, outputCsvPath)} (${rows.length} rows)`);
console.log(`Wrote ${path.relative(repoRoot, outputMdPath)}`);

