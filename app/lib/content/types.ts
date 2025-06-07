import { RecordMetadata } from "@pinecone-database/pinecone";

// Content Types
export type ContentType = 'document' | 'note' | 'activity' | 'swarm_result';

// Base Content Interface
export interface BaseContent {
  userId: string;
  access: 'public' | 'personal' | 'shared';
  categories: string[];
  createdAt: string;
}

// Document Types
export interface DocumentInput extends BaseContent {
  type: 'document';
  file: {
    name: string;
    type: string;
    size: number;
    content: string;
  };
  metadata?: {
    categories?: string[];
    category?: string;
    primaryCategory?: string;
    secondaryCategories?: string[];
    type?: string;
    source?: string;
    [key: string]: any;
  };
}

// Note Types
export interface NoteInput {
  type: 'note';
  userId: string;
  access: 'public' | 'personal' | 'shared';
  categories: string[];
  tags?: string[];
  content: string;
  title?: string;
  format?: 'text' | 'markdown' | 'rich-text';
  isPinned?: boolean;
  isStarred?: boolean;
  color?: string;
  context?: string;
  associatedDate?: string;
}

// Activity Types
export interface ActivityInput {
  type: 'activity';
  userId: string;
  access: 'public' | 'personal' | 'shared';
  activityType: 'physical' | 'work' | 'study' | 'routine';
  category: string;
  subcategory?: string;
  description?: string;
  duration: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  
  // Metrics (1-10 scale)
  energy?: number;
  productivity?: number;
  satisfaction?: number;
  
  // Goals
  goalId?: string;
  goalProgress?: number;
  goalStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  
  // Activity metrics
  metrics?: Record<string, number | string>;
  
  // Progress tracking
  sequence?: number;
  iteration?: number;
  streak?: number;
  
  // Additional fields
  notes?: string;
}

// Storage Result
export interface StorageResult {
  contentId: string;
  chunkCount: number;
  metadata: ContentMetadata;
}

// Processed Content
export interface ProcessedContent {
  contentId: string;
  chunks: string[];
  metadata: ContentMetadata;
  rawContent?: string;
}

// Content Chunk
export interface ContentChunk {
  text: string;
  metadata: ContentMetadata;
}

// Embedded Chunk
export interface EmbeddedChunk {
  id: string;
  values: number[];
  metadata: ContentMetadata;
}

// Content Metadata
export interface ContentMetadata {
  // Core Metadata - Required for all content types
  contentType: ContentType;
  contentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: 'active' | 'archived' | 'deleted';

  // Chunking Information
  chunkIndex: number;
  totalChunks: number;
  isFirstChunk: boolean;

  // Access Control
  access: 'public' | 'personal' | 'shared';
  sharedWith?: string[];

  // Classification & Organization
  categories?: string[];  // Full categories array
  category?: string;     // Primary category (for backwards compatibility)
  primaryCategory: string;
  secondaryCategories: string[];
  tags: string[];

  // Content Fields
  title?: string;
  text: string;
  summary?: string;

  // Search Optimization
  searchableText: string;
  keywords: string[];
  language?: string;

  // Relationships
  parentId?: string;
  relatedIds: string[];
  references: string[];

  // Type information
  type?: string;
  source?: string;

  // Document-specific metadata
  document?: {
    // File Information
    fileType: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    
    // Processing Information
    processingStatus: 'pending' | 'processing' | 'complete' | 'failed';
    extractionMethod: 'text' | 'ocr' | 'manual';
    
    // Document Structure
    pageCount?: number;
    currentPage?: number;
    hasImages: boolean;
    tableCount?: number;
    
    // Content Analysis
    readingTime?: number;
    complexity?: 'basic' | 'intermediate' | 'advanced';
    topicModel?: string[];
  };

  // Note-specific metadata
  note?: {
    // Organization
    isPinned: boolean;
    isStarred: boolean;
    color?: string;
    
    // Structure & Format
    format: 'text' | 'markdown' | 'rich-text';
    hasCheckboxes: boolean;
    checklistProgress?: number;
    
    // Context
    context?: string;
    associatedDate?: string;
    collaborators?: string[];
    lastEditedBy?: string;
    commentCount?: number;
  };

  // Activity-specific metadata
  activity?: {
    activityType: 'physical' | 'work' | 'study' | 'routine';
    startTime: string;
    endTime: string;
    duration: string;
    location?: string;
    
    // Metrics (1-10 scale)
    energy: number;
    productivity: number;
    satisfaction: number;
    
    // Goals
    goalId?: string;
    goalProgress?: number;
    goalStatus: 'not_started' | 'in_progress' | 'completed' | 'failed';
    
    // Activity metrics
    metrics: Record<string, number | string>;
    
    // Progress tracking
    sequence?: number;
    iteration?: number;
    streak?: number;
  };

  // Swarm-specific metadata
  swarm?: {
    agentId: string;
    taskId: string;
    confidence: number;
    resultType: 'intermediate' | 'final' | 'insight' | 'recommendation';
    performanceMetrics?: {
      processingTime: number;
      resourceUsage: number;
      qualityScore: number;
    };
    validations?: {
      method: string;
      score: number;
      timestamp: number;
    }[];
  };
}

// Pinecone metadata type that allows stringified fields
export type PineconeMetadata = RecordMetadata & {
  // Core Metadata
  contentType: string;
  contentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  status: string;
  
  // Chunking info
  chunkIndex: string;
  totalChunks: string;
  isFirstChunk: string;
  
  // Access control
  access: string;
  sharedWith?: string;
  
  // Classification
  primaryCategory: string;
  secondaryCategories: string;
  tags: string;
  
  // Content
  title?: string;
  text: string;
  summary?: string;
  
  // Search optimization
  searchableText: string;
  keywords: string;
  language?: string;
  
  // Relationships
  relatedIds?: string;
  references?: string;
  
  // Type-specific metadata (stringified)
  document?: string;
  note?: string;
  activity?: string;
  
  // System metadata
  _system: string;
}; 