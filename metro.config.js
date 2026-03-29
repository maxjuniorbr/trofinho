const { getDefaultConfig } = require("expo/metro-config");
const { createSentryMetroSerializer } = require("@sentry/react-native/metro");

const config = getDefaultConfig(__dirname);

// Exclude test files from the Metro bundler so they are never included in
// the app bundle. Without this, .test.ts(x) files inside lib/ and src/ are
// resolved by Metro and can cause runtime errors in Expo builds.
config.resolver.blockList = [/\.test\.[jt]sx?$/];

// Use Sentry's custom serializer for debug ID injection (source maps).
// We avoid withSentryConfig() because it wraps the entire config and causes
// a crash in the eager bundling phase on EAS Build (determineDebugIdFromBundleSource
// receives undefined when the serializer output format changed in SDK 55).
config.serializer.customSerializer = createSentryMetroSerializer();

module.exports = config;
