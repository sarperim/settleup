// @ts-check
// Root ESLint flat config (ESLint 9) covering all three workspace packages.
// Extend here rather than per-package — apps/api, apps/web and packages/shared
// all resolve this single config from the repository root.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.config.js',
      '**/*.config.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // TypeScript handles unused-var/parameter checking via the compiler
      // (tsconfig strict); keep ESLint in sync to avoid double flags.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
