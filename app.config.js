const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function appConfig({ config }) {
  config = withGradleProperties(config, (c) => {
    const existing = c.modResults.findIndex(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );
    const value = '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError';
    if (existing >= 0) {
      c.modResults[existing].value = value;
    } else {
      c.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value });
    }
    return c;
  });

  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
};
