import { ContentIngestion } from '../content/ingestion/ContentIngestion';
import { ContentType } from '../content/types';
import { DocumentInput } from './types';
import { NoteIngestion } from '../content/ingestion/NoteIngestion';


/**
 * Process document using the provided content processor
 */
export async function processDocument(input: DocumentInput, processor: ContentIngestion): Promise<void> {
  try {
    // Validate input
    if (!input.content?.trim()) {
      throw new Error('Content cannot be empty');
    }
    if (!input.userId) {
      throw new Error('User ID is required');
    }

    // Create initial processed content
    const initialContent = {
      contentId: input.id,
      chunks: [input.content],
      rawContent: input.content,
      metadata: {
        contentType: 'document' as ContentType,
        contentId: input.id,
        userId: input.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        status: 'active',
        chunkIndex: 0,
        totalChunks: 1,
        isFirstChunk: true,
        access: input.metadata?.access || 'personal',
        sharedWith: [],
        categories: input.metadata?.categories || [],
        primaryCategory: input.metadata?.categories?.[0] || 'document',
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

    // Process through the pipeline
    const preprocessed = await processor.preprocess(initialContent);
    const validationResult = await processor.validate(preprocessed);
    
    if (!validationResult.isValid) {
      throw new Error(`Document validation failed: ${validationResult.errors?.join(', ') || 'Unknown error'}`);
    }

    const chunks = await processor.chunk(preprocessed);
    const embeddedChunks = await processor.embed(chunks);
    await processor.store(embeddedChunks);

    console.log('Document processed successfully:', {
      id: input.id,
      chunks: chunks.length,
      embedded: embeddedChunks.length
    });

  } catch (_error) {
    console.error('Error processing document:', _error);
    throw _error;
  }
}

/**
 * Process document asynchronously (for large documents)
 */
export async function processDocumentAsync(
  documentInput: DocumentInput,
  processor: NoteIngestion
): Promise<void> {
  try {
    await processor.processContent(documentInput);
    console.log(`Background processing completed for document: ${documentInput.userId}`);
  } catch (_error) {
    console.error(`Background processing failed for document`, _error);
  }
} 