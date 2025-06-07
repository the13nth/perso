import 'cross-fetch/polyfill';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
} 