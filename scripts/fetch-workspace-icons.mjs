#!/usr/bin/env node
/**
 * Fetches file/folder icons via better-icons and generates icon data for React Native.
 * Run: node scripts/fetch-workspace-icons.mjs
 * Output: apps/mobile/src/data/workspace-icon-svgs.json
 */
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const MAPPING_PATH = path.join(__dirname, "../file-name-mapping-rules");
const OUT_DIR = path.join(__dirname, "../apps/mobile/src/data");
const OUT_JSON = path.join(OUT_DIR, "workspace-icon-svgs.json");

const folderMapping = require(path.join(MAPPING_PATH, "folder-name-mapping.json")).folderNames ?? {};
const extMapping = require(path.join(MAPPING_PATH, "file-extension-mapping.json")).fileExtensions ?? {};
const nameMapping = require(path.join(MAPPING_PATH, "exact-file-names.json")).fileNames ?? {};

const FOLDER_ICON_IDS = {
  "folder-src": "material-icon-theme:folder-src",
  "folder-dist": "material-icon-theme:folder-dist",
  "folder-node": "material-icon-theme:folder-node",
  "folder-test": "material-icon-theme:folder-test",
  "folder-components": "material-icon-theme:folder-components",
  "folder-assets": "catppuccin:folder-assets",
  "folder-public": "material-icon-theme:folder-public",
  "folder-views": "material-icon-theme:folder-views",
  "folder-utils": "material-icon-theme:folder-utils",
  "folder-config": "material-icon-theme:folder-config",
  "folder-hook": "material-icon-theme:folder-hook",
  "folder-api": "material-icon-theme:folder-api",
  "folder-scripts": "material-icon-theme:folder-scripts",
  "folder-docs": "material-icon-theme:folder-docs",
  "folder-github": "material-icon-theme:folder-github",
  "folder-git": "material-icon-theme:folder-git",
  "default-folder": "vscode-icons:default-folder",
  "default-folder-open": "vscode-icons:default-folder-opened",
  "default-root": "vscode-icons:default-root-folder",
  "default-root-open": "vscode-icons:default-root-folder-opened",
};
const FILE_ICON_IDS = {
  javascript: "vscode-icons:file-type-js-official",
  react: "vscode-icons:file-type-reactjs",
  "react-ts": "vscode-icons:file-type-reactts",
  typescript: "vscode-icons:file-type-typescript",
  json: "vscode-icons:file-type-json",
  html: "vscode-icons:file-type-html",
  css: "vscode-icons:file-type-css",
  sass: "vscode-icons:file-type-sass",
  less: "vscode-icons:file-type-less",
  python: "vscode-icons:file-type-python",
  java: "vscode-icons:file-type-java",
  c: "vscode-icons:file-type-c",
  cpp: "vscode-icons:file-type-cpp",
  csharp: "vscode-icons:file-type-csharp",
  go: "vscode-icons:file-type-go",
  rust: "vscode-icons:file-type-rust",
  php: "vscode-icons:file-type-php",
  ruby: "vscode-icons:file-type-ruby",
  console: "vscode-icons:file-type-shell",
  markdown: "vscode-icons:file-type-markdown",
  document: "vscode-icons:file-type-doc",
  table: "vscode-icons:file-type-excel",
  xml: "vscode-icons:file-type-xml",
  yaml: "vscode-icons:file-type-yaml",
  svg: "vscode-icons:file-type-svg",
  image: "vscode-icons:file-type-image",
  video: "vscode-icons:file-type-video",
  audio: "vscode-icons:file-type-audio",
  zip: "vscode-icons:file-type-zip",
  npm: "vscode-icons:file-type-npm",
  yarn: "vscode-icons:file-type-yarn",
  gulp: "vscode-icons:file-type-gulp",
  webpack: "vscode-icons:file-type-webpack",
  "typescript-config": "vscode-icons:file-type-tsconfig",
  git: "vscode-icons:file-type-git",
  docker: "vscode-icons:file-type-docker",
  readme: "material-icon-theme:readme",
  license: "vscode-icons:file-type-license",
  favicon: "vscode-icons:file-type-favicon",
  tune: "vscode-icons:file-type-dotenv",
  eslint: "vscode-icons:file-type-eslint",
  prettier: "vscode-icons:file-type-prettier",
  log: "vscode-icons:file-type-log",
  "default-file": "vscode-icons:default-file",
};

const iconIds = new Set();
Object.values(FOLDER_ICON_IDS).forEach((id) => iconIds.add(id));
Object.values(FILE_ICON_IDS).forEach((id) => iconIds.add(id));

function fetchSvg(id) {
  try {
    return execSync(`npx better-icons get "${id}" 2>/dev/null`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const svgData = {};
const folderNameToId = {};
const fileExtToId = {};
const fileNameToId = {};

for (const id of iconIds) {
  const svg = fetchSvg(id);
  if (svg) svgData[id] = svg;
}

const defFolder = FOLDER_ICON_IDS["default-folder"];
const defFolderOpen = FOLDER_ICON_IDS["default-folder-open"];
const defFile = FILE_ICON_IDS["default-file"];

for (const [folderName, key] of Object.entries(folderMapping)) {
  const id = FOLDER_ICON_IDS[key] ?? defFolder;
  if (id && svgData[id]) folderNameToId[folderName.toLowerCase()] = id;
}
for (const [ext, key] of Object.entries(extMapping)) {
  const id = FILE_ICON_IDS[key];
  if (id && svgData[id]) fileExtToId[ext.toLowerCase()] = id;
}
for (const [fileName, key] of Object.entries(nameMapping)) {
  const id = FILE_ICON_IDS[key];
  if (id && svgData[id]) fileNameToId[fileName.toLowerCase()] = id;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_JSON,
  JSON.stringify({
    svgData,
    folderNameToId,
    fileExtToId,
    fileNameToId,
    defaultFolderId: svgData[defFolder] ? defFolder : null,
    defaultFolderOpenId: svgData[defFolderOpen] ? defFolderOpen : null,
    defaultFileId: svgData[defFile] ? defFile : null,
  }),
  "utf8"
);
console.log(`Wrote ${OUT_JSON} (${Object.keys(svgData).length} icons)`);
