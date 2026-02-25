#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { RESTRICTED_PRIMITIVES, shouldScan } from './ui-primitives-policy.mjs';

const repoRoot = process.cwd();
const mobileRoot = fs.existsSync(path.join(repoRoot, 'App.tsx')) ? repoRoot : path.join(repoRoot, 'apps/mobile');
const srcRoot = path.join(mobileRoot, 'src');
const allowlistPath = path.join(mobileRoot, 'config/ui-primitives-allowlist.json');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function parseRestrictedImports(content) {
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['\"]react-native['\"]/g;
  const found = [];
  let match;
  while ((match = importRegex.exec(content))) {
    const names = match[1]
      .split(',')
      .map((s) => s.trim())
      .map((s) => s.split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);
    for (const name of names) {
      if (RESTRICTED_PRIMITIVES.includes(name)) found.push(name);
    }
  }
  return found;
}

if (!fs.existsSync(allowlistPath)) {
  console.error(`Missing allowlist: ${path.relative(repoRoot, allowlistPath)}`);
  process.exit(1);
}

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const files = walk(srcRoot)
  .map((file) => path.relative(mobileRoot, file).replace(/\\/g, '/'))
  .filter(shouldScan)
  .sort();

const violations = [];
let withRestrictedImports = 0;

for (const rel of files) {
  const abs = path.join(mobileRoot, rel);
  const content = fs.readFileSync(abs, 'utf8');
  const restricted = parseRestrictedImports(content);
  if (restricted.length === 0) continue;
  withRestrictedImports += 1;

  const allowed = new Set(allowlist[rel] || []);
  if (!allowlist[rel]) {
    violations.push(`${rel}: file is not allowlisted but imports restricted primitives (${[...new Set(restricted)].join(', ')})`);
    continue;
  }

  const uniqueRestricted = [...new Set(restricted)];
  for (const primitive of uniqueRestricted) {
    if (!allowed.has(primitive)) {
      violations.push(`${rel}: primitive ${primitive} is not allowlisted`);
    }
  }
}

for (const rel of Object.keys(allowlist)) {
  const abs = path.join(mobileRoot, rel);
  if (!fs.existsSync(abs)) {
    violations.push(`${rel}: allowlist entry points to missing file`);
  }
}

if (violations.length > 0) {
  console.error('Strict UI primitive policy failed:');
  for (const msg of violations) console.error(`- ${msg}`);
  process.exit(1);
}

console.log('Strict UI primitive policy passed.');
console.log(`Allowlisted files: ${Object.keys(allowlist).length}`);
console.log(`Current files with restricted imports: ${withRestrictedImports}`);
