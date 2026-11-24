// ESLint du front (src/). Les fonctions serveur (supabase/functions) sont du code
// Deno : elles sont vérifiées par `deno check` dans la CI, pas ici.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Seul src/ est analysé. Les deux tests exclus importent du code Deno
    // (ils sont aussi exclus de tsconfig.app.json).
    ignores: [
      '**/*',
      '!src',
      '!src/**',
      'src/lib/__tests__/agentOutils.test.ts',
      'src/lib/__tests__/mcpJeton.test.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      // ── Bloquant ────────────────────────────────────────────────────────────
      // Une promesse lancée sans await ni gestion d'erreur échoue en silence.
      // Écrire `void maFonction()` quand ne pas attendre est voulu.
      '@typescript-eslint/no-floating-promises': 'error',
      // Un hook appelé sous condition casse l'état du composant.
      'react-hooks/rules-of-hooks': 'error',
      // Les noms commençant par « _ » signalent une valeur volontairement ignorée.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true,
      }],
      // `condition && action()` est une écriture courante ici, pas une erreur.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      // Les expressions régulières contiennent exprès des espaces insécables et le BOM.
      'no-irregular-whitespace': ['error', { skipRegExps: true, skipStrings: true, skipTemplates: true }],

      // ── Avertissements : trop bruyant sur le code existant, à traiter par lots ──
      'react-hooks/exhaustive-deps': 'warn',
      // Règles « React Compiler » d'eslint-plugin-react-hooks 7.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // 29 fichiers du site public commencent par `@ts-nocheck`.
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-useless-assignment': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
