import { FormattedSection as MessageFormattedSection } from '../components/chat/MessageContent';

export type FormattedSection = MessageFormattedSection;

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  formattedContent?: FormattedSection[];
} 