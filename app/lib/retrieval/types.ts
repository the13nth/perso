import { ContentType } from '../content/types';

export interface DocumentInput {
  id: string;
  content: string;
  metadata: {
    categories?: string[];
    access?: 'public' | 'personal';
    source?: string;
    uploadedAt?: string;
    processingStartedAt?: string;
    contentType?: ContentType;
    originalFileName?: string;
    fileType?: string;
    fileSize?: number;
    extractedAt?: string;
    [key: string]: any;
  };
  type: ContentType;
  userId: string;
} 