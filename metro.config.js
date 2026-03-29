const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude test files from the Metro bundler so they are never included in
// the app bundle. Without this, .test.ts(x) files inside lib/ and src/ are
// resolved by Metro and can cause runtime errors in Expo builds.
config.resolver.blockList = [/\.test\.[jt]sx?$/];

// NOTE: Sentry source map upload is handled by the @sentry/react-native/expo
// plugin in app.config.js. The withSentryConfig/createSentryMetroSerializer
// wrappers are intentionally omitted because they crash during EAS Build's
// eager bundling phase (determineDebugIdFromBundleSource receives undefined).

module.exports = config;
