import { MarkdownTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ContentIngestion, ValidationResult, StorageResult, ContentReference } from './ContentIngestion';
import { ProcessedContent, ContentChunk, EmbeddedChunk, ContentMetadata } from '../types';
import { DocumentInput } from '@/app/lib/retrieval/types';
import { sanitizeText } from '../utils/textUtils';
import { detectLanguage, extractTopics } from '../utils/contentAnalysis';
import { Pinecone } from "@pinecone-database/pinecone";
import { auth } from "@clerk/nextjs/server";

export class DocumentIngestion implements ContentIngestion {
  private embeddings: GoogleGenerativeAIEmbeddings;
  private pinecone: Pinecone;

  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001"
    });

    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });
  }

  async processContent(input: DocumentInput): Promise<void> {
    try {
      // Get authenticated user ID
      const { userId } = await auth();
      if (!userId) {
        throw new Error('Unauthorized: User must be authenticated');
      }

      // Ensure input has the authenticated user's ID
      input.userId = userId;

      // Process the content through our pipeline
      const processed = await this.preprocess(input);
      const validationResult = await this.validate(processed);

      if (!validationResult.isValid) {
        throw new Error(`Content validation failed: ${validationResult.errors?.join(', ') || 'Unknown validation error'}`);
      }

      const chunks = await this.chunk(processed);
      const embeddedChunks = await this.embed(chunks);
      await this.store(embeddedChunks);

      console.log(`Successfully processed document: ${input.id}`);
    } catch (_error) {
      console.error('Error processing document content:', _error);
      throw _error;
    }
  }

  async preprocess(input: DocumentInput): Promise<ProcessedContent> {
    // Debug logs
    console.log('DocumentIngestion preprocess - Input:', {
      hasContent: !!input.content,
      contentLength: input.content?.length,
      contentType: typeof input.content,
      userId: input.userId,
      type: input.type,
      metadata: input.metadata
    });

    // Validate required fields
    if (!input.content?.trim()) {
      console.log('DocumentIngestion preprocess - Content validation failed:', {
        content: input.content,
        trimmedLength: input.content?.trim().length
      });
      throw new Error('Content cannot be empty');
    }
    if (!input.userId) {
      throw new Error('User ID is required');
    }

    // Sanitize the content
    const text = sanitizeText(input.content);
    const timestamp = new Date().toISOString();
    const contentId = input.id || `${input.type}-${input.userId}-${Date.now()}`;
    const inputMetadata = input.metadata || {};

    // Get async values
    const language = await detectLanguage(text);
    const topics = await extractTopics(text);

    // Generate base metadata
    const metadata: ContentMetadata = {
      // Core Metadata - Required for all content types
      contentType: input.type,
      contentId: contentId,
      userId: input.userId,
      createdAt: inputMetadata.uploadedAt || timestamp,
      updatedAt: timestamp,
      version: 1,
      status: 'active' as const,

      // Chunking Information
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,

      // Access Control
      access: inputMetadata.access || 'personal',
      sharedWith: [],

      // Classification & Organization
      categories: inputMetadata.categories || ['document'],
      category: inputMetadata.categories?.[0] || 'general',
      primaryCategory: inputMetadata.categories?.[0] || 'document',
      secondaryCategories: [],
      tags: [],

      // Content Analysis
      language,
      keywords: topics,

      // Source Information
      source: inputMetadata.source || 'user-input',
      
      // Additional Metadata
      title: inputMetadata.title || '',
      references: inputMetadata.references || [],
      text: text,
      searchableText: sanitizeText(text),
      relatedIds: [],

      // Document-specific metadata
      document: {
        fileType: inputMetadata.fileType || 'text/plain',
        fileName: inputMetadata.originalFileName || 'document.txt',
        fileSize: inputMetadata.fileSize || text.length,
        mimeType: inputMetadata.fileType || 'text/plain',
        processingStatus: 'complete',
        extractionMethod: 'text',
        hasImages: false,
        readingTime: Math.ceil(text.length / 1000)
      }
    };

    return {
      contentId,
      chunks: [text],
      rawContent: text,
      metadata
    };
  }

  async validate(content: ProcessedContent): Promise<ValidationResult> {
    // Basic validation checks
    const errors: string[] = [];

    if (!content.rawContent || content.rawContent.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (!content.metadata.userId) {
      errors.push('User ID is required');
    }

    if (!content.metadata.contentId) {
      errors.push('Content ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async chunk(content: ProcessedContent): Promise<ContentChunk[]> {
    const splitter = new MarkdownTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });

    const textChunks = await splitter.splitText(content.rawContent || '');

    return textChunks.map((chunk, index) => ({
      text: chunk,
      metadata: {
        ...content.metadata,
        chunkIndex: index,
        totalChunks: textChunks.length,
        isFirstChunk: index === 0
      }
    }));
  }

  async embed(chunks: ContentChunk[]): Promise<EmbeddedChunk[]> {
    const embeddedChunks: EmbeddedChunk[] = [];

    for (const chunk of chunks) {
      const embedding = await this.embeddings.embedQuery(chunk.text);
      embeddedChunks.push({
        id: `${chunk.metadata.contentId}-${chunk.metadata.chunkIndex}`,
        values: embedding,
        metadata: chunk.metadata
      });
    }

    return embeddedChunks;
  }

  async store(chunks: EmbeddedChunk[]): Promise<StorageResult> {
    const index = this.pinecone.index("content-index");
    
    const vectors = chunks.map(chunk => ({
      id: `${chunk.metadata.contentId}-${chunk.metadata.chunkIndex}`,
      values: chunk.values,
      metadata: {
        contentType: String(chunk.metadata.contentType),
        contentId: chunk.metadata.contentId,
        userId: chunk.metadata.userId,
        createdAt: chunk.metadata.createdAt,
        updatedAt: chunk.metadata.updatedAt,
        version: String(chunk.metadata.version),
        status: chunk.metadata.status,
        chunkIndex: String(chunk.metadata.chunkIndex),
        totalChunks: String(chunk.metadata.totalChunks),
        isFirstChunk: String(chunk.metadata.isFirstChunk),
        access: chunk.metadata.access,
        sharedWith: chunk.metadata.sharedWith?.join(',') || '',
        categories: chunk.metadata.categories?.join(',') || '',
        primaryCategory: chunk.metadata.primaryCategory,
        secondaryCategories: chunk.metadata.secondaryCategories.join(','),
        tags: chunk.metadata.tags.join(','),
        language: chunk.metadata.language || 'en',
        source: chunk.metadata.source || '',
        title: chunk.metadata.title || '',
        text: chunk.metadata.text || '',
        searchableText: chunk.metadata.searchableText || '',
        keywords: chunk.metadata.keywords?.join(',') || '',
        relatedIds: chunk.metadata.relatedIds?.join(',') || '',
        references: chunk.metadata.references?.join(',') || ''
      } satisfies Record<string, string | number | boolean>
    }));

    await index.upsert(vectors);

    return {
      contentId: chunks[0].metadata.contentId,
      chunkCount: chunks.length,
      metadata: chunks[0].metadata
    };
  }

  async extractMetadata(content: ProcessedContent): Promise<ContentMetadata> {
    const text = content.rawContent || '';
    const language = await detectLanguage(text);
    const topics = await extractTopics(text);
    return {
      ...content.metadata,
      language,
      keywords: topics
    };
  }

  generateSearchableText(content: ContentChunk): string {
    return sanitizeText(content.text);
  }

  extractKeywords(content: ContentChunk): string[] {
    return content.metadata.keywords || [];
  }

  async processReferences(content: ProcessedContent): Promise<ContentReference[]> {
    return content.metadata.references?.map(ref => ({ 
      id: ref, 
      type: 'document',
      context: `Referenced from ${content.contentId}`
    })) || [];
  }

  async linkRelatedContent(contentId: string, references: ContentReference[]): Promise<void> {
    if (!references.length) return;

    const index = this.pinecone.index("content-index");
    
    // Get the current content's metadata
    const { matches } = await index.query({
      vector: Array(1536).fill(0), // Dummy vector for metadata-only query
      filter: { contentId },
      topK: 1,
      includeMetadata: true
    });

    if (!matches?.length) {
      throw new Error(`Content ${contentId} not found`);
    }

    const currentContent = matches[0];
    const currentMetadata = currentContent.metadata as Record<string, string>;

    // Update metadata with new references
    const existingRefs = currentMetadata.references?.split(',').filter(Boolean) || [];
    const newRefs = references.map(ref => ref.id);
    const updatedRefs = Array.from(new Set([...existingRefs, ...newRefs]));

    // Update the document with new references
    await index.update({
      id: currentContent.id,
      metadata: {
        ...currentMetadata,
        references: updatedRefs.join(',')
      }
    });

    console.log(`Successfully linked ${references.length} references to content ${contentId}`);
  }
} 