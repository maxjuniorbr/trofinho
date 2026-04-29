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
    env: {
      TZ: 'America/Sao_Paulo',
    },
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        // test-renderer's ESM build uses extensionless sub-path imports
        // (e.g. "react-reconciler/constants") which fail in strict ESM.
        // Inlining lets Vite resolve them correctly.
        inline: ['test-renderer'],
      },
    },
     
    coverage: {
      // @ts-expect-error -- `all` is functional in Vitest 4.x but was removed from CoverageOptions types; will self-flag when types catch up
      all: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'lib/**/*.ts',
        'src/**/*.ts',
        'src/**/*.tsx',
        'app/**/*.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'lib/supabase.ts',
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
        'app/**/_layout.tsx',
        'app/(admin)/tasks/index.tsx',
        'app/(child)/historico.tsx',
        'app/(child)/redemptions/index.tsx',
        'app/(child)/notifications.tsx',
        'src/components/children/child-view-sheet.tsx',
        'src/components/prizes/prize-form-sheet.tsx',
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
