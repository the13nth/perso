import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ContentIngestion, ValidationResult, StorageResult, ContentReference } from './ContentIngestion';
import { ProcessedContent, ContentChunk, EmbeddedChunk, ContentMetadata, DocumentInput, PineconeMetadata } from '../types';
import { sanitizeText } from '../utils/textUtils';
import { detectLanguage, extractTopics } from '../utils/contentAnalysis';
import { Pinecone } from "@pinecone-database/pinecone";
import { MarkdownTextSplitter } from "langchain/text_splitter";

export class DocumentIngestion implements ContentIngestion {
  private embeddings: GoogleGenerativeAIEmbeddings;
  private pinecone: Pinecone;
  
  constructor() {
    console.log('Initializing DocumentIngestion with environment:', {
      hasGoogleKey: !!process.env.GOOGLE_API_KEY,
      hasPineconeKey: !!process.env.PINECONE_API_KEY,
      hasPineconeIndex: !!process.env.PINECONE_INDEX,
      hasPineconeEnv: !!process.env.PINECONE_ENVIRONMENT
    });

    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is not set');
    }

    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not set');
    }

    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX is not set');
    }

    if (!process.env.PINECONE_ENVIRONMENT) {
      throw new Error('PINECONE_ENVIRONMENT is not set');
    }

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "embedding-001"
    });
    
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    // Test Pinecone connection
    this.testPineconeConnection().catch(error => {
      console.error('Failed to test Pinecone connection:', error);
    });

    console.log('DocumentIngestion initialized successfully');
  }

  private async testPineconeConnection(): Promise<void> {
    try {
      const index = this.pinecone.index(process.env.PINECONE_INDEX || "");
      const stats = await index.describeIndexStats();
      console.log('Pinecone connection test successful:', {
        index: process.env.PINECONE_INDEX,
        stats
      });
    } catch (error) {
      console.error('Pinecone connection test failed:', {
        error: error instanceof Error ? error.message : error,
        index: process.env.PINECONE_INDEX
      });
      throw error;
    }
  }

  async preprocess(document: DocumentInput): Promise<ProcessedContent> {
    console.log('Starting document preprocessing:', {
      userId: document.userId,
      fileSize: document.file.size,
      categories: document.categories
    });

    // Extract text based on file type
    const text = sanitizeText(document.file.content || '');
    const timestamp = new Date().toISOString();
    const contentId = `doc-${document.userId}-${Date.now()}`;
    const categories = document.categories || ['general'];
    
    console.log('Document text extracted:', {
      contentId,
      textLength: text.length,
      timestamp
    });

    // Generate base metadata
    const metadata: ContentMetadata = {
      // Core Metadata - Required for all content types
      contentType: 'document' as const,
      contentId: contentId,
      userId: document.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      status: 'active' as const,

      // Chunking Information
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,

      // Access Control
      access: document.access,
      sharedWith: [],

      // Classification & Organization
      categories: categories, // Full categories array
      category: categories[0], // Primary category
      primaryCategory: categories[0],
      secondaryCategories: categories.slice(1),
      tags: [],

      // Content Fields
      title: document.file.name || 'Untitled Document',
      text: text.substring(0, 1000), // Store first 1000 chars for preview
      summary: '',

      // Search Optimization
      searchableText: text.substring(0, 1000),
      keywords: [],
      language: 'en',

      // Relationships
      relatedIds: [],
      references: [],

      // Type information
      type: 'document',
      source: 'user_upload',

      // Document-specific metadata
      document: {
        // File Information
        fileType: (document.file.type || '').split('/')[1] || '',
        fileName: document.file.name || 'document.txt',
        fileSize: document.file.size || 0,
        mimeType: document.file.type || 'text/plain',
        
        // Processing Information
        processingStatus: 'pending' as const,
        extractionMethod: 'text' as const,
        
        // Document Structure (will be updated during processing)
        hasImages: false,
        
        // Content Analysis (will be updated during processing)
        complexity: 'basic' as const
      }
    };

    console.log('Generated document metadata:', {
      contentId: metadata.contentId,
      type: metadata.type,
      categories: metadata.categories,
      title: metadata.title
    });

    return {
      contentId,
      chunks: [text],
      rawContent: text,
      metadata
    };
  }

  async validate(content: ProcessedContent): Promise<ValidationResult> {
    const errors: string[] = [];
    const text = content.rawContent || '';
    
    if (!text) {
      errors.push('Document content is empty');
    } else if (text.length > 50000) {
      errors.push('Document exceeds maximum length of 50,000 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async chunk(content: ProcessedContent): Promise<ContentChunk[]> {
    const text = content.rawContent || '';
    if (!text) {
      return [];
    }

    // For documents, we use different chunking strategy
    const splitter = new MarkdownTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100
    });
    
    const chunks = await splitter.splitText(text);
    
    return chunks.map((chunkText, index) => ({
      text: chunkText,
      metadata: {
        ...content.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        isFirstChunk: index === 0
      }
    }));
  }

  async embed(chunks: ContentChunk[]): Promise<EmbeddedChunk[]> {
    return Promise.all(
      chunks.map(async (chunk) => {
        // Create a ProcessedContent from the chunk for metadata extraction
        const processedChunk: ProcessedContent = {
          contentId: chunk.metadata.contentId,
          chunks: [chunk.text],
          rawContent: chunk.text,
          metadata: chunk.metadata
        };
        
        const searchableText = this.generateSearchableText(processedChunk);
        const embedding = await this.embeddings.embedQuery(searchableText);
        
        return {
          id: `${chunk.metadata.contentId}_chunk_${chunk.metadata.chunkIndex}`,
          values: embedding,
          metadata: {
            ...chunk.metadata,
            searchableText,
            keywords: this.extractKeywords(processedChunk)
          }
        };
      })
    );
  }

  async store(chunks: EmbeddedChunk[]): Promise<StorageResult> {
    console.log('Starting document storage process:', {
      chunksCount: chunks.length,
      firstChunkId: chunks[0]?.metadata.contentId
    });

    // Verify Pinecone connection
    try {
      const index = this.pinecone.index(process.env.PINECONE_INDEX || "");
      console.log('Successfully connected to Pinecone index:', process.env.PINECONE_INDEX);

      // Log index stats if available
      try {
        const stats = await index.describeIndexStats();
        console.log('Pinecone index stats:', stats);
      } catch (error) {
        console.warn('Could not fetch index stats:', error);
      }
    
      // Convert EmbeddedChunks to PineconeRecords with proper metadata structure
      const records = chunks.map(chunk => {
        console.log('Processing chunk:', {
          chunkId: chunk.id,
          contentId: chunk.metadata.contentId,
          metadataKeys: Object.keys(chunk.metadata)
        });

        const metadata = {
          // Core Metadata
          contentType: String(chunk.metadata.contentType),
          contentId: chunk.metadata.contentId,
          userId: chunk.metadata.userId,
          createdAt: chunk.metadata.createdAt,
          updatedAt: chunk.metadata.updatedAt,
          version: String(chunk.metadata.version),
          status: chunk.metadata.status,
          
          // Chunking info
          chunkIndex: String(chunk.metadata.chunkIndex),
          totalChunks: String(chunk.metadata.totalChunks),
          isFirstChunk: String(chunk.metadata.isFirstChunk),
          
          // Access control
          access: chunk.metadata.access,
          sharedWith: chunk.metadata.sharedWith?.join(',') || '',
          
          // Classification
          categories: chunk.metadata.categories?.join(',') || '',
          category: chunk.metadata.category || '',
          primaryCategory: chunk.metadata.primaryCategory,
          secondaryCategories: chunk.metadata.secondaryCategories.join(','),
          tags: chunk.metadata.tags.join(','),
          type: chunk.metadata.type || 'document',
          source: chunk.metadata.source || 'user_upload',
          
          // Content
          title: chunk.metadata.title || '',
          text: chunk.metadata.text || '',
          summary: chunk.metadata.summary || '',
          searchableText: chunk.metadata.searchableText,
          
          // Search optimization
          keywords: chunk.metadata.keywords.join(','),
          language: chunk.metadata.language || 'en',
          
          // Relationships
          relatedIds: chunk.metadata.relatedIds?.join(',') || '',
          references: chunk.metadata.references?.join(',') || '',
          
          // Document specific
          document: JSON.stringify({
            fileType: chunk.metadata.document?.fileType || '',
            fileName: chunk.metadata.document?.fileName || '',
            fileSize: chunk.metadata.document?.fileSize || 0,
            mimeType: chunk.metadata.document?.mimeType || 'text/plain',
            processingStatus: chunk.metadata.document?.processingStatus || 'pending',
            extractionMethod: chunk.metadata.document?.extractionMethod || 'text',
            hasImages: chunk.metadata.document?.hasImages || false,
            complexity: chunk.metadata.document?.complexity || 'basic'
          }),
          
          // System metadata
          _system: JSON.stringify({
            lastIndexed: new Date().toISOString(),
            indexVersion: 1,
            vectorQuality: 0.9
          })
        } satisfies PineconeMetadata;

        console.log('Prepared metadata for storage:', {
          id: chunk.id,
          contentId: metadata.contentId,
          type: metadata.type,
          categories: metadata.categories,
          title: metadata.title,
          vectorLength: chunk.values.length
        });

        return {
          id: chunk.id,
          values: chunk.values,
          metadata
        };
      });
    
      // Store in batches
      const batchSize = 5;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        try {
          console.log(`Attempting to store batch ${i/batchSize + 1}:`, {
            batchSize: batch.length,
            firstId: batch[0].id
          });

          const response = await index.upsert(batch);
          console.log(`Successfully stored batch ${i/batchSize + 1}:`, {
            batchSize: batch.length,
            response
          });
        } catch (error) {
          console.error('Error storing batch in Pinecone:', {
            batchNumber: i/batchSize + 1,
            error: error instanceof Error ? error.message : error,
            batch: batch.map(r => ({ id: r.id, contentId: r.metadata.contentId }))
          });
          throw error;
        }
      
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    
      console.log('Document storage completed successfully:', {
        totalChunks: chunks.length,
        contentId: chunks[0].metadata.contentId
      });

      return {
        contentId: chunks[0].metadata.contentId,
        chunkCount: chunks.length,
        metadata: chunks[0].metadata
      };
    } catch (error) {
      console.error('Fatal error during document storage:', {
        error: error instanceof Error ? error.message : error,
        contentId: chunks[0]?.metadata.contentId
      });
      throw error;
    }
  }

  async extractMetadata(content: ProcessedContent): Promise<ContentMetadata> {
    const text = content.rawContent || '';
    return {
      ...content.metadata,
      language: await detectLanguage(text),
      keywords: await extractTopics(text),
      document: {
        // File Information
        fileType: content.metadata.document?.fileType || '',
        fileName: content.metadata.document?.fileName || 'document.txt',
        fileSize: content.metadata.document?.fileSize || 0,
        mimeType: content.metadata.document?.mimeType || 'text/plain',
        
        // Processing Information
        processingStatus: content.metadata.document?.processingStatus || 'pending',
        extractionMethod: content.metadata.document?.extractionMethod || 'text',
        
        // Document Structure
        hasImages: this.detectImages(text),
        pageCount: content.metadata.document?.pageCount,
        currentPage: content.metadata.document?.currentPage,
        tableCount: content.metadata.document?.tableCount,
        
        // Content Analysis
        complexity: this.analyzeComplexity(text),
        readingTime: content.metadata.document?.readingTime,
        topicModel: content.metadata.document?.topicModel
      }
    };
  }

  generateSearchableText(content: ProcessedContent): string {
    const text = content.rawContent || '';
    const metadata = content.metadata;
    return [
      metadata.title,
      text,
      metadata.keywords?.join(' '),
      metadata.primaryCategory,
      ...metadata.secondaryCategories
    ].filter(Boolean).join(' ');
  }

  extractKeywords(content: ProcessedContent): string[] {
    const text = content.rawContent || '';
    // Extract hashtags from markdown
    const hashTags = (text.match(/#[\w-]+/g) || [])
      .map(tag => tag.slice(1));
    
    // Extract @mentions
    const mentions = (text.match(/@[\w-]+/g) || [])
      .map(mention => mention.slice(1));
    
    // Combine and deduplicate
    const uniqueKeywords = new Set([...hashTags, ...mentions]);
    return Array.from(uniqueKeywords);
  }

  async processReferences(content: ProcessedContent): Promise<ContentReference[]> {
    const references: ContentReference[] = [];
    const text = content.rawContent || '';
    
    // Extract markdown links
    const markdownLinks = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    for (const link of markdownLinks) {
      const [, text, url] = link.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
      if (text && url) {
        references.push({
          id: url,
          type: 'link',
          context: text
        });
      }
    }
    
    // Extract @mentions as user references
    const mentions = text.match(/@[\w-]+/g) || [];
    for (const mention of mentions) {
      references.push({
        id: mention.slice(1),
        type: 'user',
        context: 'mentioned'
      });
    }
    
    return references;
  }

  async linkRelatedContent(contentId: string, references: ContentReference[]): Promise<void> {
    const index = this.pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Update metadata to include references
    await index.update({
      id: contentId,
      metadata: {
        linkedReferences: references.map(ref => ref.id).join(',')
      }
    });
  }




  private detectImages(text: string): boolean {
    return /!\[.*?\]\(.*?\)/.test(text);
  }



  private analyzeComplexity(text: string): 'basic' | 'intermediate' | 'advanced' {
    // Simple complexity analysis based on length and structure
    if (text.length > 5000 || text.includes('```')) return 'advanced';
    if (text.length > 1000 || text.includes('#')) return 'intermediate';
    return 'basic';
  }
} 