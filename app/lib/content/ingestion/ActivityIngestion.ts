import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ContentIngestion, ValidationResult, StorageResult, ContentReference } from './ContentIngestion';
import { ProcessedContent, ContentChunk, EmbeddedChunk, ContentMetadata, ActivityInput, PineconeMetadata } from '../types';
import { sanitizeText } from '../utils/textUtils';
import { detectLanguage, extractTopics } from '../utils/contentAnalysis';
import { Pinecone } from "@pinecone-database/pinecone";

export class ActivityIngestion implements ContentIngestion {
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

  async preprocess(activity: ActivityInput): Promise<ProcessedContent> {
    const text = sanitizeText(activity.description || '');
    const timestamp = new Date().toISOString();
    const contentId = `activity-${activity.userId}-${Date.now()}`;
    
    // Build categories array with type safety
    const categories: string[] = [];
    if (activity.category) categories.push(activity.category);
    if (activity.subcategory) categories.push(activity.subcategory);
    if (categories.length === 0) categories.push('general');
    
    // Generate base metadata
    const metadata: ContentMetadata = {
      // Core Metadata
      contentType: 'activity' as const,
      contentId: contentId,
      userId: activity.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      status: 'active' as const,

      // Chunking Information
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,

      // Access Control
      access: activity.access,
      sharedWith: [],

      // Classification & Organization
      categories: categories, // Full categories array
      category: categories[0], // Primary category
      primaryCategory: categories[0],
      secondaryCategories: categories.slice(1),
      tags: [],

      // Content Fields
      title: `${activity.activityType} Activity - ${new Date(activity.startTime || timestamp).toLocaleDateString()}`,
      text: text,
      summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),

      // Search Optimization
      searchableText: [
        activity.activityType,
        activity.category,
        activity.subcategory,
        text,
        activity.location
      ].filter(Boolean).join(' '),
      keywords: [],
      language: 'en',

      // Relationships
      relatedIds: [],
      references: [],

      // Type information
      type: 'activity',
      source: 'user_input',

      // Activity-specific metadata
      activity: {
        activityType: activity.activityType,
        startTime: activity.startTime || timestamp,
        endTime: activity.endTime || timestamp,
        duration: activity.duration,
        location: activity.location,
        
        // Metrics
        energy: activity.energy || 0,
        productivity: activity.productivity || 0,
        satisfaction: activity.satisfaction || 0,
        
        // Goals
        goalId: activity.goalId,
        goalProgress: activity.goalProgress,
        goalStatus: activity.goalStatus || 'not_started',
        
        // Activity metrics
        metrics: activity.metrics || {},
        
        // Progress tracking
        sequence: activity.sequence,
        iteration: activity.iteration,
        streak: activity.streak
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
    const text = content.rawContent || '';
    
    if (!text) {
      errors.push('Activity description is empty');
    } else if (text.length > 5000) {
      errors.push('Activity description exceeds maximum length of 5,000 characters');
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

    return [{
      text,
      metadata: {
        ...content.metadata,
        chunkIndex: 0,
        totalChunks: 1,
        isFirstChunk: true
      }
    }];
  }

  async embed(chunks: ContentChunk[]): Promise<EmbeddedChunk[]> {
    return Promise.all(
      chunks.map(async (chunk) => {
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
        
        // Content
        title: chunk.metadata.title || '',
        text: chunk.metadata.searchableText,
        summary: chunk.metadata.summary || '',
        
        // Search optimization
        searchableText: chunk.metadata.searchableText,
        keywords: chunk.metadata.keywords.join(','),
        language: chunk.metadata.language || 'en',
        
        // Relationships
        relatedIds: chunk.metadata.relatedIds?.join(',') || '',
        references: chunk.metadata.references?.join(',') || '',
        
        // Activity specific
        activity: JSON.stringify(chunk.metadata.activity || {}),
        
        // System metadata
        _system: JSON.stringify({
          lastIndexed: new Date().toISOString(),
          indexVersion: 1,
          vectorQuality: 0.9
        })
      } satisfies PineconeMetadata;

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
      await index.upsert(batch);
      
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

  async extractMetadata(content: ProcessedContent): Promise<ContentMetadata> {
    const text = content.rawContent || '';
    return {
      ...content.metadata,
      language: await detectLanguage(text),
      keywords: await extractTopics(text)
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
      ...metadata.secondaryCategories,
      metadata.activity?.activityType,
      metadata.activity?.location
    ].filter(Boolean).join(' ');
  }

  extractKeywords(content: ProcessedContent): string[] {
    const text = content.rawContent || '';
    // Extract hashtags from text
    const hashTags = (text.match(/#[\w-]+/g) || [])
      .map(tag => tag.slice(1));
    
    // Extract @mentions
    const mentions = (text.match(/@[\w-]+/g) || [])
      .map(mention => mention.slice(1));
    
    // Add activity-specific keywords
    const activityKeywords = [
      content.metadata.activity?.activityType,
      content.metadata.activity?.location,
      content.metadata.activity?.goalStatus
    ].filter(Boolean) as string[];
    
    // Combine and deduplicate
    const uniqueKeywords = new Set([...hashTags, ...mentions, ...activityKeywords]);
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
    
    // Add goal reference if present
    if (content.metadata.activity?.goalId) {
      references.push({
        id: content.metadata.activity.goalId,
        type: 'goal',
        context: 'associated_goal'
      });
    }
    
    return references;
  }

  async linkRelatedContent(contentId: string, references: ContentReference[]): Promise<void> {
    const index = this.pinecone.index(process.env.PINECONE_INDEX || "");
    
    await index.update({
      id: contentId,
      metadata: {
        linkedReferences: references.map(ref => ref.id).join(',')
      }
    });
  }
} 