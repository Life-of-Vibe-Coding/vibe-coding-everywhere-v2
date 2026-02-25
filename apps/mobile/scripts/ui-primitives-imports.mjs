import { APPROVED_REACT_NATIVE_NON_PRIMITIVES, RESTRICTED_PRIMITIVES } from './ui-primitives-policy.mjs';

function normalizeImportToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const typeOnly = /^type\s+/.test(trimmed);
  const withoutType = trimmed.replace(/^type\s+/, '').trim();
  const baseName = withoutType.split(/\s+as\s+/)[0]?.trim();
  if (!baseName) return null;
  return { baseName, typeOnly };
}

function parseReactNativeImportTokens(content) {
  const importRegex = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]react-native['"]/g;
  const runtimeNames = [];
  let match;

  while ((match = importRegex.exec(content))) {
    const statementTypeOnly = Boolean(match[1]);
    const body = match[2] ?? '';
    const tokens = body
      .split(',')
      .map((item) => normalizeImportToken(item))
      .filter(Boolean);

    for (const token of tokens) {
      if (statementTypeOnly || token.typeOnly) continue;
      runtimeNames.push(token.baseName);
    }
  }

  return runtimeNames;
}

export function parseReactNativeImports(content) {
  const runtimeNames = parseReactNativeImportTokens(content);
  const restricted = runtimeNames.filter((name) => RESTRICTED_PRIMITIVES.includes(name));
  const unapproved = runtimeNames.filter(
    (name) =>
      !RESTRICTED_PRIMITIVES.includes(name) &&
      !APPROVED_REACT_NATIVE_NON_PRIMITIVES.includes(name)
  );

  return {
    runtimeNames,
    restricted,
    unapproved,
  };
}
