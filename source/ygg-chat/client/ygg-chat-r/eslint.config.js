import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Build output and bundled copies (electron/*.mjs except the build script) are not source.
  { ignores: ['dist', 'dist-electron', 'dist-server', 'release', 'vendor', 'node_modules', 'electron/*.mjs', '!electron/esbuild.main.mjs', 'server/headlessServer/ui/mobile/assets/mobile-app.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Loose `any` types are widespread in the inherited Yggdrasil code. They are
      // reported as warnings so new code can still be tightened without making
      // `npm run lint` unusable; they do not affect how the app runs.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Common, intentional patterns: `_unused` names, omitting a field with
      // `{ omitted, ...rest }`, and deliberately ignored errors in `catch {}`.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      // `let timer; ... timer = setTimeout(...)` read inside a callback must stay `let`.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      // Hadron deliberately strips terminal and control characters from untrusted text.
      'no-control-regex': 'off',
    },
  },
  {
    // Tests: fixture cleanup guards throw from `finally`, and small render helpers call hooks directly.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'no-unsafe-finally': 'off',
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      'require-yield': 'off',
    },
  }
)
