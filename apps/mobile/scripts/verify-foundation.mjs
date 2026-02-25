#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const mobileRoot = fs.existsSync(path.join(repoRoot, 'App.tsx')) ? repoRoot : path.join(repoRoot, 'apps/mobile');

const checks = [];
const failures = [];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function addCheck(name, passed, details) {
  checks.push({ name, passed, details });
  if (!passed) failures.push({ name, details });
}

function exists(relPath) {
  return fs.existsSync(path.join(mobileRoot, relPath));
}

try {
  const tsconfig = JSON.parse(read(path.join(mobileRoot, 'tsconfig.json')));
  const alias = tsconfig?.compilerOptions?.paths?.['@/*'];
  addCheck(
    'import-alias-tsconfig',
    Array.isArray(alias) && alias.includes('src/*'),
    'tsconfig paths must include "@/*": ["src/*"]'
  );
} catch (error) {
  addCheck('import-alias-tsconfig', false, `Unable to parse tsconfig.json: ${error.message}`);
}

try {
  const metro = read(path.join(mobileRoot, 'metro.config.js'));
  const hasAtAlias = /moduleName\s*===\s*['"`]@['"`]/.test(metro) && /moduleName\.startsWith\(\s*['"`]@\//.test(metro);
  addCheck('import-alias-metro', hasAtAlias, 'metro resolver should handle @ and @/ aliases');
} catch (error) {
  addCheck('import-alias-metro', false, `Unable to read metro.config.js: ${error.message}`);
}

try {
  const css = read(path.join(mobileRoot, 'global.css'));
  const hasLightDark = css.includes('@variant light') && css.includes('@variant dark');
  const requiredTokens = [
    '--color-background-0',
    '--color-text-primary',
    '--color-border',
    '--background',
    '--foreground',
  ];
  const missing = requiredTokens.filter((token) => !css.includes(token));
  addCheck(
    'theme-token-definitions',
    hasLightDark && missing.length === 0,
    missing.length ? `Missing tokens: ${missing.join(', ')}` : 'light/dark variants and base tokens exist'
  );
} catch (error) {
  addCheck('theme-token-definitions', false, `Unable to read global.css: ${error.message}`);
}

try {
  const appTsx = read(path.join(mobileRoot, 'App.tsx'));
  const providerWiring = appTsx.includes('<ThemeProvider') && appTsx.includes('<GluestackUIProvider mode={themeState.themeMode}>');
  addCheck(
    'dark-light-provider-wiring',
    providerWiring,
    'App.tsx should wrap app with ThemeProvider and GluestackUIProvider using themeState.themeMode'
  );
} catch (error) {
  addCheck('dark-light-provider-wiring', false, `Unable to read App.tsx: ${error.message}`);
}

try {
  const provider = read(path.join(mobileRoot, 'src/components/ui/gluestack-ui-provider/index.tsx'));
  const portalInfra = provider.includes('OverlayProvider') && provider.includes('ToastProvider');
  addCheck(
    'portal-overlay-infra',
    portalInfra,
    'GluestackUIProvider should include OverlayProvider and ToastProvider'
  );
} catch (error) {
  addCheck('portal-overlay-infra', false, `Unable to read gluestack provider: ${error.message}`);
}

try {
  const portal = read(path.join(mobileRoot, 'src/components/ui/portal/index.tsx'));
  const hasPortal = portal.includes('Overlay') && portal.includes('export { Portal }');
  addCheck('portal-component-export', hasPortal, 'Portal component should wrap Overlay and export Portal');
} catch (error) {
  addCheck('portal-component-export', false, `Unable to read portal component: ${error.message}`);
}

try {
  const cnPrimary = exists('src/utils/cn.ts');
  const cnSecondary = exists('src/lib/utils.ts');
  let srcLibContent = '';
  if (cnSecondary) srcLibContent = read(path.join(mobileRoot, 'src/lib/utils.ts'));
  const noDuplicate = !cnSecondary || srcLibContent.includes('export { cn }') || !srcLibContent.includes('function cn');
  addCheck(
    'cn-single-source',
    cnPrimary && noDuplicate,
    'cn should be defined once (src/utils/cn.ts), and src/lib/utils.ts should re-export only'
  );
} catch (error) {
  addCheck('cn-single-source', false, `Unable to verify cn utilities: ${error.message}`);
}

const summary = {
  total: checks.length,
  passed: checks.filter((c) => c.passed).length,
  failed: checks.filter((c) => !c.passed).length,
};

console.log(JSON.stringify({ summary, checks }, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
