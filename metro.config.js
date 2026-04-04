const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Remove deprecated options injected by getSentryExpoConfig to keep the
// build output free of Metro validation warnings.
delete config.server.tls;
delete config.watcher.unstable_workerThreads;

// Exclude test files from the Metro bundler so they are never included in
// the app bundle. Without this, .test.ts(x) files inside lib/ and src/ are
// resolved by Metro and can cause runtime errors in Expo builds.
config.resolver.blockList = [/\.test\.[jt]sx?$/];

module.exports = config;
