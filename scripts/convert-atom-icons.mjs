#!/usr/bin/env node
/**
 * Converts Atom-style SVG icons to PNG for Expo/React Native.
 * Run: node scripts/convert-atom-icons.mjs
 */

import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "apps", "mobile", "assets", "icons");

const ICONS = [
  {
    name: "folder",
    url: "https://cdn.jsdelivr.net/gh/primer/octicons@main/icons/file-directory-16.svg",
  },
  {
    name: "folder-open",
    url: "https://cdn.jsdelivr.net/gh/primer/octicons@main/icons/file-directory-fill-16.svg",
  },
  {
    name: "file",
    url: "https://cdn.jsdelivr.net/gh/file-icons/icons@master/svg/Default.svg",
  },
];

const SIZE = 32;

async function main() {
  const sharp = (await import("sharp")).default;

  await mkdir(OUT_DIR, { recursive: true });

  for (const { name, url } of ICONS) {
    console.log(`Fetching ${name}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const svgBuffer = Buffer.from(await res.arrayBuffer());

    const outPath = join(OUT_DIR, `${name}.png`);
    await sharp(svgBuffer)
      .resize(SIZE, SIZE)
      .png()
      .toFile(outPath);
    console.log(`  -> ${outPath}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
