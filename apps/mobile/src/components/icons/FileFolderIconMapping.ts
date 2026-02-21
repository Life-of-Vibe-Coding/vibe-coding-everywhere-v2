/**
 * Maps file-name-mapping-rules keys to Iconify icon IDs (better-icons format).
 * Used by WorkspaceTreeIcons to render file/folder icons.
 *
 * Source: file-name-mapping-rules/{folder-name-mapping,file-extension-mapping,exact-file-names,default-fall-back}.json
 * Icons: material-icon-theme (folders), vscode-icons (files) via better-icons
 */

export type FolderIconKey =
  | "folder-src"
  | "folder-dist"
  | "folder-node"
  | "folder-test"
  | "folder-components"
  | "folder-assets"
  | "folder-public"
  | "folder-views"
  | "folder-utils"
  | "folder-config"
  | "folder-hook"
  | "folder-api"
  | "folder-scripts"
  | "folder-docs"
  | "folder-github"
  | "folder-git"
  | "default-folder"
  | "default-folder-open"
  | "default-root"
  | "default-root-open";

export type FileIconKey =
  | "javascript"
  | "react"
  | "react-ts"
  | "typescript"
  | "json"
  | "html"
  | "css"
  | "sass"
  | "less"
  | "python"
  | "java"
  | "c"
  | "cpp"
  | "csharp"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "console"
  | "markdown"
  | "document"
  | "table"
  | "xml"
  | "yaml"
  | "svg"
  | "image"
  | "video"
  | "audio"
  | "zip"
  | "npm"
  | "yarn"
  | "gulp"
  | "webpack"
  | "typescript-config"
  | "git"
  | "docker"
  | "readme"
  | "license"
  | "favicon"
  | "tune"
  | "eslint"
  | "prettier"
  | "log"
  | "default-file";

/** Iconify ID: "prefix:icon-name" for better-icons get */
export const FOLDER_ICON_IDS: Record<FolderIconKey, string> = {
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

export const FILE_ICON_IDS: Record<string, string> = {
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
