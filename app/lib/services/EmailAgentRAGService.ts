import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '@clerk/nextjs/server';
import { Message } from 'ai';
import { BaseRAGService, RAGResponse } from './BaseRAGService';
import { initializeGeminiModel } from '@/app/utils/modelInit';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

// Initialize the Google Gen AI client
const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

interface EmailData {
  id: string;
  from: string;
  subject: string;
  date: string;
  content?: string;
  snippet?: string;
  hasFullContent: boolean;
}

const EMAIL_SYSTEM_PROMPT = `You are an email-focused AI agent designed to help users understand and analyze their email communications.

ROLE AND EXPERTISE:
- Primary Focus: Email Analysis and Management
- Core Purpose: Help users process, understand, and act on their emails effectively

KEY CAPABILITIES:
1. Email Content Analysis
   - Identify important information and action items
   - Detect urgency and priority levels
   - Recognize deadlines and commitments
   - Extract key details and requests

2. Communication Pattern Analysis
   - Identify frequent correspondents
   - Analyze response times and patterns
   - Detect communication trends

3. Action Item Management
   - List required responses and follow-ups
   - Track deadlines and commitments
   - Prioritize urgent matters

4. Summary Generation
   - Create concise email summaries
   - Group related conversations
   - Highlight key decisions and outcomes

RESPONSE FORMAT:
1. Overview
   - Brief summary of the email situation
   - Number of emails analyzed
   - Key patterns or urgent items

2. Important Actions Required
   - List of emails needing immediate attention
   - Deadlines and time-sensitive items
   - Required responses or follow-ups

3. Detailed Analysis
   - Breakdown of significant emails
   - Context and relationships between messages
   - Important details and implications

4. Recommendations
   - Suggested actions and priorities
   - Response recommendations
   - Organization suggestions

GUIDELINES:
1. Privacy & Security
   - Never share sensitive information
   - Maintain confidentiality
   - Handle personal data with care

2. Clarity & Precision
   - Be clear and specific
   - Provide actionable insights
   - Use concrete examples

3. Context Awareness
   - Consider email history
   - Note relationships between messages
   - Maintain conversation context

Current conversation history:
{chat_history}

Available email data:
{email_data}

User query: {query}

Response:`;

export class EmailAgentRAGService implements BaseRAGService {
  private async fetchEmails(): Promise<EmailData[]> {
    // Get auth session
    const session = await auth();
    if (!session || !session.userId) {
      throw new Error('User not authenticated');
    }

    // Get session token
    const token = await session.getToken();
    
    // Get base URL from environment or default
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Construct absolute URL
    const url = `${baseUrl}/api/integrations/gmail/debug`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch emails:', response.status, await response.text());
      throw new Error(`Failed to fetch emails: ${response.status}`);
    }

    const data = await response.json();
    return data.emails;
  }

  private formatEmailsForContext(emails: EmailData[]): string {
    // Group emails by date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groupedEmails = emails.reduce((acc, email) => {
      const emailDate = new Date(email.date);
      
      let group = 'Older';
      if (emailDate.toDateString() === today.toDateString()) {
        group = 'Today';
      } else if (emailDate.toDateString() === yesterday.toDateString()) {
        group = 'Yesterday';
      } else if (emailDate > new Date(today.setDate(today.getDate() - 7))) {
        group = 'This Week';
      } else if (emailDate > new Date(today.setDate(today.getDate() - 30))) {
        group = 'This Month';
      }
      
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(email);
      return acc;
    }, {} as Record<string, EmailData[]>);

    // Format emails by group
    let formattedEmails = '';
    for (const [group, emails] of Object.entries(groupedEmails)) {
      formattedEmails += `\n${group}:\n`;
      emails.forEach(email => {
        formattedEmails += `
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
${email.hasFullContent ? 'Content:' : 'Preview:'}
${email.hasFullContent ? email.content : email.snippet}
-------------------
`;
      });
    }

    return formattedEmails;
  }

  public async generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse> {
    try {
      const startTime = Date.now();
      console.log(`Generating response for agent: ${agentId}`);
      console.log(`Message count: ${messages.length}`);
      
      const currentMessage = messages[messages.length - 1];
      console.log('User query:', currentMessage.content);

      const emails = await this.fetchEmails();
      const formattedEmails = this.formatEmailsForContext(emails);

      // Format chat history
      const chatHistory = messages.slice(0, -1)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Generate response using the model
      const model = await initializeGeminiModel({
        maxOutputTokens: 2048,
        temperature: 0.7
      });

      const prompt = new PromptTemplate({
        template: EMAIL_SYSTEM_PROMPT
          .replace('{chat_history}', '{chatHistory}')
          .replace('{email_data}', '{emailData}')
          .replace('{query}', '{userQuery}'),
        inputVariables: ['chatHistory', 'emailData', 'userQuery']
      });

      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      const responseText = await chain.invoke({
        chatHistory: chatHistory,
        emailData: formattedEmails,
        userQuery: currentMessage.content
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        success: true,
        response: responseText,
        agentId,
        contextUsed: emails.length,
        results: [{
          timestamp: endTime,
          success: true,
          responseTime,
          output: {
            insights: [{
              insight: "Email data analyzed",
              evidence: `Analyzed ${emails.length} emails`,
              confidence: 1.0,
              category: "email"
            }],
            metadata: {
              responseTime,
              contextUsed: emails.length > 0,
              categoriesAnalyzed: ['email'],
              confidenceScore: 0.8
            }
          },
          metrics: {
            contextRelevance: 0.8,
            insightQuality: 0.8,
            responseLatency: responseTime
          }
        }],
        relevanceScores: emails.map(email => ({
          source: email.subject,
          score: email.hasFullContent ? 1.0 : 0.5,
          category: 'email'
        })),
        categoryContexts: [{
          category: 'email',
          count: emails.length,
          relevantCount: emails.filter(e => e.hasFullContent).length
        }]
      };
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        success: false,
        response: "Failed to generate response",
        agentId,
        contextUsed: 0,
        results: [{
          timestamp: Date.now(),
          success: false,
          responseTime: 0,
          output: {
            insights: [],
            metadata: {
              responseTime: 0,
              contextUsed: false,
              categoriesAnalyzed: [],
              confidenceScore: 0
            }
          },
          metrics: {
            contextRelevance: 0,
            insightQuality: 0,
            responseLatency: 0
          }
        }],
        relevanceScores: [],
        categoryContexts: []
      };
    }
  }
} 