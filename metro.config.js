const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const exclusionList = require("metro-config/src/defaults/exclusionList");

const config = getSentryExpoConfig(__dirname);

// Exclude test files from the Metro bundler so they are never included in
// the app bundle. Without this, .test.ts(x) files inside lib/ and src/ are
// resolved by Metro and can cause runtime errors in Expo builds.
config.resolver.blockList = exclusionList([/\.test\.[jt]sx?$/]);

module.exports = config;
