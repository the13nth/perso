import { ProcessedContent, ContentChunk, EmbeddedChunk, ContentMetadata } from '../types';

export interface ContentIngestion {
  // Base content processing
  preprocess(content: any): Promise<ProcessedContent>;
  validate(content: ProcessedContent): Promise<ValidationResult>;
  chunk(content: ProcessedContent): Promise<ContentChunk[]>;
  embed(chunks: ContentChunk[]): Promise<EmbeddedChunk[]>;
  store(chunks: EmbeddedChunk[]): Promise<StorageResult>;
  
  // Metadata extraction
  extractMetadata(content: ProcessedContent): Promise<ContentMetadata>;
  generateSearchableText(content: ContentChunk): string;
  extractKeywords(content: ContentChunk): string[];
  
  // Relationship handling
  processReferences(content: ProcessedContent): Promise<ContentReference[]>;
  linkRelatedContent(contentId: string, references: ContentReference[]): Promise<void>;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface StorageResult {
  contentId: string;
  chunkCount: number;
  metadata: ContentMetadata;
}

export interface ContentReference {
  id: string;
  type: string;
  context: string;
}
