module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    es2022: true,
  },
  ignorePatterns: ['dist/**', 'node_modules/**'],
  overrides: [
    {
      files: ['packages/core/src/**/*.ts', 'packages/pdf/src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: ['fs', 'path', 'url'],
            patterns: ['node:*'],
          },
        ],
      },
    },
  ],
}
