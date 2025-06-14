import { ContentType } from '../content/types';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'error';

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

export interface FirestoreDocument {
  id: string;
  userId: string;
  content: string;
  metadata: DocumentInput['metadata'];
  type: ContentType;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
} 