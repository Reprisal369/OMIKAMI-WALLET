import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/out/**', '**/dist/**', '**/coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'viem/accounts',
              message:
                'Key-material handling is forbidden in this codebase (THREAT_MODEL A2). Signing happens only in the user wallet.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Browser storage requires explicit threat-model review (A2/privacy).' },
        { name: 'sessionStorage', message: 'Browser storage requires explicit threat-model review (A2/privacy).' },
        { name: 'indexedDB', message: 'Browser storage requires explicit threat-model review (A2/privacy).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Browser storage requires explicit threat-model review.' },
        { object: 'window', property: 'sessionStorage', message: 'Browser storage requires explicit threat-model review.' },
        { object: 'window', property: 'indexedDB', message: 'Browser storage requires explicit threat-model review.' },
        { object: 'globalThis', property: 'localStorage', message: 'Browser storage requires explicit threat-model review.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Raw HTML injection is forbidden (THREAT_MODEL F2).',
        },
      ],
    },
  },
  {
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['apps/web/src/lib/rpc-storage.ts'],
    rules: {
      // Reviewed exception (THREAT_MODEL C1c): the single module allowed to
      // use browser storage, for the validated custom RPC URL only.
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
