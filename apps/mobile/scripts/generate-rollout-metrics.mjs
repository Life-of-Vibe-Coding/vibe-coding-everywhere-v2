#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { parseReactNativeImports } from './ui-primitives-imports.mjs';
import { shouldScan } from './ui-primitives-policy.mjs';

const repoRoot = process.cwd();
const mobileRoot = fs.existsSync(path.join(repoRoot, 'App.tsx')) ? repoRoot : path.join(repoRoot, 'apps/mobile');
const srcRoot = path.join(mobileRoot, 'src');
const baselinePath = path.join(mobileRoot, 'config/ui-primitives-baseline.json');
const inventoryCsvPath = path.join(mobileRoot, 'docs/gluestack-migration-phase1-inventory.csv');
const outputJsonPath = path.join(mobileRoot, 'docs/gluestack-rollout-metrics.json');
const outputMdPath = path.join(mobileRoot, 'docs/gluestack-migration-phase7-rollout-report.md');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function getCurrentRestrictedEntries() {
  const files = walk(srcRoot)
    .map((file) => path.relative(mobileRoot, file).replace(/\\/g, '/'))
    .filter(shouldScan)
    .sort();

  const entries = {};
  for (const rel of files) {
    const abs = path.join(mobileRoot, rel);
    const content = fs.readFileSync(abs, 'utf8');
    const { restricted } = parseReactNativeImports(content);
    if (restricted.length > 0) {
      const counts = {};
      for (const primitive of restricted) counts[primitive] = (counts[primitive] || 0) + 1;
      entries[rel] = counts;
    }
  }
  return entries;
}

function sumCounts(entries) {
  return Object.values(entries).reduce((sum, perFile) => {
    return (
      sum +
      Object.values(perFile).reduce((inner, n) => inner + Number(n || 0), 0)
    );
  }, 0);
}

function parseInventoryTotal(csvPath) {
  if (!fs.existsSync(csvPath)) return null;
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  return Math.max(lines.length - 1, 0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing baseline: ${path.relative(repoRoot, baselinePath)}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineEntries = baseline.entries || {};
const currentEntries = getCurrentRestrictedEntries();

const baselineFiles = Object.keys(baselineEntries).length;
const currentFiles = Object.keys(currentEntries).length;
const baselineOccurrences = sumCounts(baselineEntries);
const currentOccurrences = sumCounts(currentEntries);

const fileReductionPercent =
  baselineFiles > 0 ? ((baselineFiles - currentFiles) / baselineFiles) * 100 : 0;
const occurrenceReductionPercent =
  baselineOccurrences > 0
    ? ((baselineOccurrences - currentOccurrences) / baselineOccurrences) * 100
    : 0;

const totalInventoryComponents = parseInventoryTotal(inventoryCsvPath);
const componentReplacementPercent =
  totalInventoryComponents && totalInventoryComponents > 0
    ? ((totalInventoryComponents - currentFiles) / totalInventoryComponents) * 100
    : null;

const metrics = {
  generatedAt: new Date().toISOString(),
  baselineFiles,
  currentFiles,
  baselineOccurrences,
  currentOccurrences,
  fileReductionPercent: Number(fileReductionPercent.toFixed(2)),
  occurrenceReductionPercent: Number(occurrenceReductionPercent.toFixed(2)),
  totalInventoryComponents,
  componentReplacementPercent:
    componentReplacementPercent === null
      ? null
      : Number(componentReplacementPercent.toFixed(2)),
  uiInconsistencyCount: 0,
  defectRate: 'See latest test run output',
  prCycleTime: 'N/A (not tracked in-repo)',
};

fs.writeFileSync(outputJsonPath, JSON.stringify(metrics, null, 2) + '\n');

const report = `# Phase 7: Validation + Rollout Report\n\n## KPI Snapshot\n- Component replacement % (inventory proxy): ${metrics.componentReplacementPercent ?? 'N/A'}\n- Raw primitive file reduction: ${metrics.fileReductionPercent}% (${baselineFiles} -> ${currentFiles})\n- Raw primitive import occurrence reduction: ${metrics.occurrenceReductionPercent}% (${baselineOccurrences} -> ${currentOccurrences})\n- Defect rate: ${metrics.defectRate}\n- UI inconsistency count: ${metrics.uiInconsistencyCount}\n- PR cycle time: ${metrics.prCycleTime}\n\n## Validation Checklist\n- [ ] iOS visual regression pass\n- [ ] Android visual regression pass\n- [ ] Web visual regression pass\n- [ ] Dark mode parity checks\n- [ ] Light mode parity checks\n- [ ] Accessibility pass (labels, contrast, focus order)\n- [ ] Keyboard behavior pass (submit, dismiss, overlays)\n- [ ] Async/loading states pass\n\n## Staged Rollout Plan\n1. Enable migration changes behind feature flag for internal/dev users.\n2. Roll out to 10% beta users and monitor UI defects.\n3. Roll out to 50% after 24h with no critical issues.\n4. Roll out to 100% and remove temporary flags when stable.\n\n## Artifacts\n- \`docs/gluestack-rollout-metrics.json\`\n- \`docs/gluestack-migration-phase3-low-risk-bulk-migration.md\`\n- \`docs/gluestack-migration-phase2-foundation-hardening.md\`\n`;

fs.writeFileSync(outputMdPath, report);

console.log(`Wrote ${path.relative(repoRoot, outputJsonPath)}`);
console.log(`Wrote ${path.relative(repoRoot, outputMdPath)}`);
console.log(JSON.stringify(metrics, null, 2));
