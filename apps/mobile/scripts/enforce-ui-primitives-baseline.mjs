#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { RESTRICTED_PRIMITIVES, shouldScan } from './ui-primitives-policy.mjs';
import { parseReactNativeImports } from './ui-primitives-imports.mjs';

const repoRoot = process.cwd();
const mobileRoot = fs.existsSync(path.join(repoRoot, "App.tsx")) ? repoRoot : path.join(repoRoot, "apps/mobile");
const srcRoot = path.join(mobileRoot, 'src');
const baselinePath = path.join(mobileRoot, 'config/ui-primitives-baseline.json');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing baseline file: ${path.relative(repoRoot, baselinePath)}`);
  console.error('Run: npm run -w mobile capture:ui-primitives-baseline');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baseEntries = baseline.entries || {};

const files = walk(srcRoot)
  .map((file) => path.relative(mobileRoot, file).replace(/\\/g, '/'))
  .filter(shouldScan)
  .sort();

const currentEntries = {};
for (const rel of files) {
  const abs = path.join(mobileRoot, rel);
  const content = fs.readFileSync(abs, 'utf8');
  const { restricted } = parseReactNativeImports(content);
  if (restricted.length > 0) {
    const counts = {};
    for (const p of restricted) counts[p] = (counts[p] || 0) + 1;
    currentEntries[rel] = counts;
  }
}

const violations = [];
for (const [file, currentCounts] of Object.entries(currentEntries)) {
  const baseCounts = baseEntries[file] || {};
  for (const [primitive, count] of Object.entries(currentCounts)) {
    const baseCount = baseCounts[primitive] || 0;
    if (count > baseCount) {
      violations.push(`${file}: ${primitive} increased ${baseCount} -> ${count}`);
    }
  }
  for (const primitive of Object.keys(currentCounts)) {
    if (!(primitive in baseCounts) && currentCounts[primitive] > 0) {
      violations.push(`${file}: new primitive import ${primitive}`);
    }
  }
}

for (const [file, baseCounts] of Object.entries(baseEntries)) {
  if (!(file in currentEntries)) continue;
  for (const primitive of Object.keys(baseCounts)) {
    if (!(primitive in currentEntries[file])) {
      continue;
    }
  }
}

if (violations.length > 0) {
  console.error('UI primitive policy failed (net-new raw react-native trivial primitives detected):');
  for (const line of violations) console.error(`- ${line}`);
  process.exit(1);
}

console.log('UI primitive policy passed (no net-new raw primitive imports).');
console.log(`Tracked files in baseline: ${Object.keys(baseEntries).length}`);
console.log(`Current files with restricted imports: ${Object.keys(currentEntries).length}`);
