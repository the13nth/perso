import { DocumentIngestion } from './ingestion/DocumentIngestion';
import { NoteIngestion } from './ingestion/NoteIngestion';
import { ActivityIngestion } from './ingestion/ActivityIngestion';
import { DocumentInput, NoteInput, ActivityInput, StorageResult, ContentType, ProcessedContent } from './types';
import { v4 as uuidv4 } from 'uuid';

export class ContentProcessor {
  private documentIngestion: DocumentIngestion;
  private noteIngestion: NoteIngestion;
  private activityIngestion: ActivityIngestion;
  private processingQueue: Map<string, DocumentInput> = new Map();
  
  constructor() {
    this.documentIngestion = new DocumentIngestion();
    this.noteIngestion = new NoteIngestion();
    this.activityIngestion = new ActivityIngestion();
  }

  async processContent(content: DocumentInput | NoteInput | ActivityInput): Promise<StorageResult> {
    console.log('Starting content processing:', {
      type: content.type,
      userId: content.userId,
      categories: 'categories' in content ? content.categories : undefined
    });

    // 1. Select appropriate ingestion handler
    const handler = this.getIngestionHandler(content.type);
    console.log('Selected ingestion handler:', content.type);
    
    // 2. Preprocess content
    console.log('Preprocessing content...');
    const processed = await handler.preprocess(content as any);
    console.log('Content preprocessed:', {
      contentId: processed.contentId,
      chunkCount: processed.chunks.length
    });
    
    // 3. Validate content
    console.log('Validating content...');
    const validation = await handler.validate(processed);
    if (!validation.isValid) {
      console.error('Content validation failed:', validation.errors);
      throw new Error(`Content validation failed: ${validation.errors?.join(', ')}`);
    }
    console.log('Content validation successful');
    
    // 4. Extract metadata
    console.log('Extracting metadata...');
    const metadata = await handler.extractMetadata(processed);
    console.log('Metadata extracted:', {
      contentId: metadata.contentId,
      categories: metadata.categories,
      type: metadata.type
    });
    
    // 5. Generate chunks
    console.log('Generating chunks...');
    const chunks = await handler.chunk(processed);
    console.log('Chunks generated:', chunks.length);
    
    // 6. Process each chunk
    console.log('Processing chunks...');
    const embeddedChunks = await handler.embed(chunks);
    console.log('Chunks embedded:', embeddedChunks.length);
    
    // 7. Store in vector database
    console.log('Storing chunks in vector database...');
    const result = await handler.store(embeddedChunks);
    console.log('Storage completed:', {
      contentId: result.contentId,
      chunkCount: result.chunkCount
    });
    
    // 8. Process references and relationships
    console.log('Processing references...');
    const references = await handler.processReferences(processed);
    await handler.linkRelatedContent(metadata.contentId, references);
    console.log('References processed:', references.length);
    
    return result;
  }

  private getIngestionHandler(type: ContentType) {
    switch (type) {
      case 'document':
        return this.documentIngestion;
      case 'note':
        return this.noteIngestion;
      case 'activity':
        return this.activityIngestion;
      default:
        throw new Error(`Unknown content type: ${type}`);
    }
  }

  /**
   * Start asynchronous processing of a document
   */
  async startAsyncProcessing(input: DocumentInput): Promise<string> {
    const processingId = uuidv4();
    console.log('Starting async processing:', {
      processingId,
      userId: input.userId,
      categories: input.categories
    });

    this.processingQueue.set(processingId, input);
    
    // Start processing in background
    this.processAsync(processingId).catch(error => {
      console.error('Background processing error:', {
        processingId,
        error: error instanceof Error ? error.message : error
      });
    });

    return processingId;
  }

  /**
   * Process a document synchronously
   */
  async process(input: DocumentInput): Promise<ProcessedContent> {
    console.log('Processing document input:', {
      userId: input.userId,
      categories: input.categories,
      fileSize: input.file.size
    });

    try {
      const result = await this.processContent(input);
      console.log('Document processing completed:', {
        contentId: result.contentId,
        chunkCount: result.chunkCount
      });
      return {
        contentId: result.contentId,
        chunks: result.metadata.totalChunks > 0 ? new Array(result.metadata.totalChunks).fill('') : [],
        rawContent: input.file.content,
        metadata: result.metadata
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  /**
   * Process a document asynchronously
   */
  private async processAsync(processingId: string): Promise<void> {
    console.log('Processing async document:', processingId);
    const input = this.processingQueue.get(processingId);
    if (!input) {
      console.warn('No input found for processing ID:', processingId);
      return;
    }

    try {
      await this.process(input);
      this.processingQueue.delete(processingId);
      console.log('Async processing completed:', processingId);
    } catch (error) {
      console.error('Error in async processing:', {
        processingId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

} 