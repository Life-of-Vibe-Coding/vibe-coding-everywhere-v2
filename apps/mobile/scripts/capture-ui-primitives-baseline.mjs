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
    for (const p of restricted) counts[p] = (counts[p] || 0) + 1;
    entries[rel] = counts;
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  policy: 'No net-new direct react-native trivial primitive imports in src/components feature layer',
  restrictedPrimitives: RESTRICTED_PRIMITIVES,
  entries,
};

fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n');

console.log(`Captured baseline at ${path.relative(repoRoot, baselinePath)}`);
console.log(`Tracked files: ${Object.keys(entries).length}`);
