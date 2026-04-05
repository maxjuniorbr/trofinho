import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@lib': path.resolve(__dirname, 'lib'),
      '@types': path.resolve(__dirname, 'src/types'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
     
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'lib/**/*.ts',
        'src/**/*.ts',
        'src/**/*.tsx',
        'app/index.tsx',
        'app/**/login.tsx',
        'app/**/register.tsx',
        'app/**/onboarding.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'lib/supabase.ts',
        'lib/notifications.ts',
        'src/constants/assets.ts',
        'src/constants/theme.ts',
        'src/context/theme-context.tsx',
        'src/components/balance/**',
        'src/components/profile/**',
        'src/components/ui/notification-permission-banner.tsx',
        'src/components/ui/sticky-footer-screen.tsx',
        'src/components/tasks/**',
        'src/hooks/use-transient-message.ts',
        'src/hooks/queries/index.ts',
        'src/hooks/queries/use-*.ts',
        'app/**/_layout.tsx',
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
      },
    } as any,
  },
});
