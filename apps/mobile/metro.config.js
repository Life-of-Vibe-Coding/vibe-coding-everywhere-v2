const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);
const srcAliasRoot = path.resolve(__dirname, "src");

// Fix "runtime not ready" / "Property 'Platform' doesn't exist" on Hermes
config.resolver ??= {};
config.resolver.unstable_enablePackageExports = false;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@") {
    return context.resolveRequest(context, srcAliasRoot, platform);
  }
  if (moduleName.startsWith("@/")) {
    return context.resolveRequest(
      context,
      path.resolve(srcAliasRoot, moduleName.slice(2)),
      platform
    );
  }

  // tailwindcss/resolveConfig was removed in v4; @gluestack-ui/utils still imports it for theme.screens
  if (moduleName === "tailwindcss/resolveConfig") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/shim-tailwind-resolveConfig.js"),
    };
  }
  // tailwindcss v4 exposes subpaths (e.g. tailwindcss/plugin) only via package.json "exports"
  const usePackageExports = ["uniwind", "culori", "tailwindcss"].some((prefix) =>
    moduleName === prefix || moduleName.startsWith(prefix + "/")
  );
  if (usePackageExports) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: true },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./src/uniwind-types.d.ts",
  polyfills: { rem: 14 },
});
