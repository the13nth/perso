 /* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround: Allow Plot to accept any props due to lack of type info from dynamic import
declare module 'react-plotly.js' {
  import type { ComponentType } from 'react';
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const Plot: ComponentType<any>;
  export default Plot;
} 