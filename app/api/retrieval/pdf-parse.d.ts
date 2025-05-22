declare module 'pdf-parse/lib/pdf-parse.js' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }

  export default function parse(
    dataBuffer: Buffer, 
    options?: { 
      pagerender?: (pageData: any) => string; 
      max?: number;
    }
  ): Promise<PDFParseResult>;
}

declare module 'pdf-parse/lib/pdf-parse' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }

  export default function parse(
    dataBuffer: Buffer, 
    options?: { 
      pagerender?: (pageData: any) => string; 
      max?: number;
    }
  ): Promise<PDFParseResult>;
}

declare module 'pdf-parse' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }

  export default function parse(
    dataBuffer: Buffer, 
    options?: { 
      pagerender?: (pageData: any) => string; 
      max?: number;
    }
  ): Promise<PDFParseResult>;
} 