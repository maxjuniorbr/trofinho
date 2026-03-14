// app.config.js — recebe a base do app.json e injeta apenas valores dinâmicos.
module.exports = ({ config }) => ({
  ...config,
  plugins: Array.from(
    new Set([
      ...(config.plugins ?? []),
      '@react-native-community/datetimepicker',
    ])
  ),
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
