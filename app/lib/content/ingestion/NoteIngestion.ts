import { MarkdownTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ContentIngestion, ValidationResult, StorageResult, ContentReference } from './ContentIngestion';
import { ProcessedContent, ContentChunk, EmbeddedChunk, ContentMetadata, NoteInput, PineconeMetadata } from '../types';
import { DocumentInput } from '@/app/lib/retrieval/types';
import { sanitizeText } from '../utils/textUtils';
import { detectLanguage, extractTopics } from '../utils/contentAnalysis';
import { Pinecone } from "@pinecone-database/pinecone";

export class NoteIngestion implements ContentIngestion {
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
      // Convert document input to note input format
      const noteInput: NoteInput = {
        content: input.content,
        userId: input.userId,
        title: input.metadata?.title || `Document - ${new Date().toLocaleDateString()}`,
        categories: input.metadata?.categories || ['document'],
        tags: input.metadata?.tags || [],
        access: 'personal',
        isPinned: false,
        isStarred: false,
        format: 'text',
        type: 'note'
      };

      // Process the content through our pipeline
      const processed = await this.preprocess(noteInput);
      const validationResult = await this.validate(processed);
      
      if (!validationResult.isValid) {
        throw new Error(`Content validation failed: ${validationResult.errors?.join(', ') || 'Unknown validation error'}`);
      }

      const chunks = await this.chunk(processed);
      const embeddedChunks = await this.embed(chunks);
      await this.store(embeddedChunks);

      console.log(`Successfully processed document: ${input.id}`);
    } catch (error) {
      console.error('Error processing document content:', error);
      throw error;
    }
  }

  async preprocess(note: NoteInput): Promise<ProcessedContent> {
    // Sanitize the note content
    const text = sanitizeText(note.content);
    const timestamp = new Date().toISOString();
    const contentId = `note-${note.userId}-${Date.now()}`;
    
    // Generate base metadata
    const metadata: ContentMetadata = {
      // Core Metadata - Required for all content types
      contentType: 'note' as const,
      contentId: contentId,
      userId: note.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      status: 'active' as const,

      // Chunking Information
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,

      // Access Control
      access: note.access,
      sharedWith: [],

      // Classification & Organization
      categories: note.categories,
      category: note.categories[0],
      primaryCategory: note.categories[0] || 'general',
      secondaryCategories: note.categories.slice(1),
      tags: note.tags || [],

      // Content Fields
      title: note.title || `Note - ${new Date().toLocaleDateString()}`,
      text: text,
      summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),

      // Search Optimization
      searchableText: text,
      keywords: note.tags || [],
      language: 'en',

      // Relationships
      relatedIds: [],
      references: [],

      // Type information
      type: 'note',
      source: 'user_input',

      // Note-specific metadata
      note: {
        // Organization
        isPinned: note.isPinned || false,
        isStarred: note.isStarred || false,
        color: note.color,
        
        // Structure & Format
        format: note.format || 'text',
        hasCheckboxes: this.detectCheckboxes(text),
        checklistProgress: this.calculateChecklistProgress(text),
        
        // Context
        context: note.context,
        associatedDate: note.associatedDate,
        
        // Collaboration
        collaborators: [],
        lastEditedBy: note.userId,
        commentCount: 0
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
    const errors: string[] = [];
    
    if (!content.rawContent) {
      errors.push('Note content is empty');
    } else if (content.rawContent.length > 50000) {
      errors.push('Note exceeds maximum length of 50,000 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async chunk(content: ProcessedContent): Promise<ContentChunk[]> {
    if (!content.rawContent) {
      return [];
    }

    // For notes, we use different chunking strategy
    const splitter = new MarkdownTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100
    });
    
    const chunks = await splitter.splitText(content.rawContent);
    
    return chunks.map((text, index) => ({
      text,
      metadata: {
        ...content.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        isFirstChunk: index === 0,
        hasCheckboxes: this.detectCheckboxes(text),
        containsCode: this.detectCodeBlocks(text)
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
    const index = this.pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Convert EmbeddedChunks to PineconeRecords with proper metadata structure
    const records = chunks.map(chunk => {
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
        type: chunk.metadata.type || 'note',
        source: chunk.metadata.source || 'user_input',
        
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
        
        // Note specific
        note: JSON.stringify({
          isPinned: chunk.metadata.note?.isPinned || false,
          isStarred: chunk.metadata.note?.isStarred || false,
          color: chunk.metadata.note?.color || '',
          format: chunk.metadata.note?.format || 'text',
          hasCheckboxes: chunk.metadata.note?.hasCheckboxes || false,
          checklistProgress: chunk.metadata.note?.checklistProgress || 0,
          context: chunk.metadata.note?.context || '',
          associatedDate: chunk.metadata.note?.associatedDate || '',
          collaborators: chunk.metadata.note?.collaborators || [],
          lastEditedBy: chunk.metadata.note?.lastEditedBy || chunk.metadata.userId,
          commentCount: chunk.metadata.note?.commentCount || 0
        }),
        
        // System metadata
        _system: JSON.stringify({
          lastIndexed: new Date().toISOString(),
          indexVersion: 1,
          vectorQuality: 0.9
        })
      } satisfies PineconeMetadata;

      // Log metadata for debugging
      console.log('Storing note with metadata:', {
        contentId: metadata.contentId,
        type: metadata.type,
        categories: metadata.categories,
        title: metadata.title
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
        await index.upsert(batch);
        console.log(`Successfully stored batch ${i/batchSize + 1}, size: ${batch.length}`);
      } catch (error) {
        console.error('Error storing batch in Pinecone:', error);
        throw error;
      }
      
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return {
      contentId: chunks[0].metadata.contentId,
      chunkCount: chunks.length,
      metadata: chunks[0].metadata
    };
  }

  private calculateChecklistProgress(text: string): number {
    const checkboxes = text.match(/\[[ x]\]/g) || [];
    const totalCheckboxes = checkboxes.length;
    if (totalCheckboxes === 0) return 0;
    
    const checkedBoxes = checkboxes.filter(box => box === '[x]').length;
    return Math.round((checkedBoxes / totalCheckboxes) * 100);
  }

  async extractMetadata(content: ProcessedContent): Promise<ContentMetadata> {
    const text = content.rawContent || '';
    return {
      ...content.metadata,
      language: await detectLanguage(text),
      keywords: await extractTopics(text),
      note: {
        ...content.metadata.note,
        hasCheckboxes: this.detectCheckboxes(text),
        format: content.metadata.note?.format || 'text',
        isPinned: content.metadata.note?.isPinned || false,
        isStarred: content.metadata.note?.isStarred || false,
        checklistProgress: this.calculateChecklistProgress(text)
      }
    };
  }

  generateSearchableText(content: ProcessedContent): string {
    const metadata = content.metadata;
    return [
      metadata.title,
      content.rawContent,
      metadata.keywords?.join(' '),
      metadata.primaryCategory,
      ...metadata.secondaryCategories,
      metadata.tags?.join(' ')
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

  async linkRelatedContent(_contentId: string, _references: ContentReference[]): Promise<void> {
    // Implement content linking logic
  }

  // Helper methods
  private detectCheckboxes(text: string): boolean {
    return /- \[ \]|\* \[ \]/.test(text);
  }

  private detectCodeBlocks(text: string): boolean {
    return /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  }
} 