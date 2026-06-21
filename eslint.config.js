import globals from 'globals';

export default [
  {
    files: ['src/**/*.js', 'build.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
      },
    },
    rules: {
      // Catch the failure modes that matter for a modular refactor:
      // dangling references to functions that moved into a module, and
      // leftover dead bindings after an extraction.
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
    },
  },
];
