import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [{
  ignores: [
    'node_modules/**',
    '.next/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.config.js'
  ]
}, {
  files: ['**/*.{js,jsx,ts,tsx}'],
  plugins: {
    '@typescript-eslint': tsPlugin,
    'react-hooks': reactHooksPlugin,
    '@next/next': nextPlugin
  },
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-unused-vars': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CatchClause > Identifier[name="error"]',
        message: 'Use _error instead of error as catch parameter name'
      }
    ]
  }
}]; 