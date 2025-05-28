import 'isomorphic-fetch';

// Re-export the fetch API
export const fetch = globalThis.fetch;

export default fetch; 