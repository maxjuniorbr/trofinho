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
      '.tmp/**',
      'android/**',
      'ios/**',
      'src/types/database.types.ts',
      'supabase/migrations/**',
      'supabase/seed.sql',
      'supabase/functions/**',
      '.agents/**',
      'google-cloud-sdk/**',
    ],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    // React Compiler rules added in eslint-config-expo@56. Existing code predates
    // these checks; downgrade to warnings so the SDK 56 migration can land. Address
    // findings incrementally in dedicated follow-up commits.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]);
