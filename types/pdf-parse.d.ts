declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    info: { [key: string]: unknown };
    metadata: { [key: string]: unknown };
    version: string;
    numpages: number;
  }
  
  function pdf(buffer: Buffer): Promise<PDFData>;
  export = pdf;
} 