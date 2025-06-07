import { ContentIngestion } from '../content/ingestion/ContentIngestion';
import { ProcessedContent, ContentType } from '../content/types';
import { DocumentInput } from './types';

function convertToProcessedContent(input: DocumentInput): ProcessedContent {
  const now = new Date().toISOString();
  
  return {
    contentId: input.id,
    chunks: [input.content],
    rawContent: input.content,
    metadata: {
      contentType: 'document' as ContentType,
      contentId: input.id,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: 'active',
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,
      access: 'personal',
      sharedWith: [],
      categories: [],
      primaryCategory: 'document',
      secondaryCategories: [],
      tags: [],
      title: input.metadata?.title || 'Document',
      text: input.content,
      summary: input.content.substring(0, 200),
      searchableText: input.content,
      keywords: [],
      language: 'en',
      relatedIds: [],
      references: [],
      ...input.metadata
    }
  };
}

/**
 * Process document using the provided content processor
 */
export async function processDocument(
  documentInput: DocumentInput,
  processor: ContentIngestion
): Promise<void> {
  try {
    // Convert input to ProcessedContent
    const processedContent = convertToProcessedContent(documentInput);
    
    // Start processing
    const preprocessed = await processor.preprocess(processedContent);
    
    // Validate
    const validationResult = await processor.validate(preprocessed);
    if (!validationResult.isValid) {
      throw new Error(`Document validation failed: ${validationResult.errors?.join(', ') || 'Unknown error'}`);
    }
    
    // Process in chunks
    const chunks = await processor.chunk(preprocessed);
    const embeddedChunks = await processor.embed(chunks);
    
    // Store results
    await processor.store(embeddedChunks);
    
    console.log('Document processed successfully:', {
      id: documentInput.id,
      chunks: chunks.length,
      embedded: embeddedChunks.length
    });
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
} 