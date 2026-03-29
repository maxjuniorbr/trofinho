const { getDefaultConfig } = require("expo/metro-config");
const { withSentryConfig } = require("@sentry/react-native/metro");

const config = getDefaultConfig(__dirname);

// Exclude test files from the Metro bundler so they are never included in
// the app bundle. Without this, .test.ts(x) files inside lib/ and src/ are
// resolved by Metro and can cause runtime errors in Expo builds.
config.resolver.blockList = [/\.test\.[jt]sx?$/];

module.exports = withSentryConfig(config);
