import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

module.exports = {
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  ignores: [
    'node_modules/**',
    '.next/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.config.js'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-unused-vars': 'off', // Turn off the base rule as it can report incorrect errors
    'react-hooks/exhaustive-deps': 'warn'
  }
}; 