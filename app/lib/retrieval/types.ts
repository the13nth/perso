export interface DocumentInput {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  type?: string;
  userId: string;
} 