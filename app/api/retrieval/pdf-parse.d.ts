declare module 'pdf-parse/lib/pdf-parse.js' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }

  export default function parse(
    dataBuffer: Buffer, 
    options?: { 
      pagerender?: (pageData: Record<string, unknown>) => string; 
      max?: number;
    }
  ): Promise<PDFParseResult>;
}

declare module 'pdf-parse/lib/pdf-parse' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }

  export default function parse(
    dataBuffer: Buffer, 
    options?: { 
      pagerender?: (pageData: Record<string, unknown>) => string; 
      max?: number;
    }
  ): Promise<PDFParseResult>;
}

declare module 'pdf-parse' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }

  export default function parse(
    dataBuffer: Buffer, 
    options?: { 
      pagerender?: (pageData: Record<string, unknown>) => string; 
      max?: number;
    }
  ): Promise<PDFParseResult>;
} 