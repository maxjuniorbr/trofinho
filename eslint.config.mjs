import { defineConfig } from 'eslint/config';
import expo from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  expo,
  prettier,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'src/types/database.types.ts',
      'supabase/migrations/**',
      'supabase/seed.sql',
      'supabase/functions/**',
      '.agents/**',
    ],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'import/no-named-as-default-member': 'off',
    },
  },
]);
