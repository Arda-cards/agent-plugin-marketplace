import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'scratch/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  { files: ['eslint.config.mjs'], extends: [js.configs.recommended] },
  {
    files: ['scripts/**/*.{js,cjs,mjs}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'Program',
        message: 'Write scripts and tests in strict TypeScript so typecheck covers them.',
      }],
    },
  },
  {
    files: ['scripts/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { minimumDescriptionLength: 10 }],
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
);
