import pdfParse from 'pdf-parse';

export interface PDFProcessingResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creationDate?: string;
    pageCount: number;
  };
}

interface PDFInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  CreationDate?: string;
}

export async function processPDF(buffer: Buffer): Promise<PDFProcessingResult> {
  try {
    const data = await pdfParse(buffer);
    const info = data.info as PDFInfo;
    
    return {
      text: data.text,
      metadata: {
        title: info?.Title,
        author: info?.Author,
        subject: info?.Subject,
        keywords: info?.Keywords?.split(',').map((k: string) => k.trim()).filter(Boolean),
        creationDate: info?.CreationDate,
        pageCount: data.numpages
      }
    };
  } catch (_error) {
    console.error('Error processing PDF:', _error);
    throw new Error('Failed to process PDF document');
  }
} 