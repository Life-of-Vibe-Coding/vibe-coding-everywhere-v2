const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

// Fix "runtime not ready" / "Property 'Platform' doesn't exist" on Hermes
config.resolver ??= {};
config.resolver.unstable_enablePackageExports = false;

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
