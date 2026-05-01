declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string;
      EXPO_PUBLIC_SENTRY_DSN?: string;
      GOOGLE_ANDROID_CLIENT_ID: string;
      EXPO_OS: 'android';
    }
  }
}

export {};
