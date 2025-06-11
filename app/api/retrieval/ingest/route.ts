import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { adminDb } from "@/lib/firebase/admin";
import { google } from "googleapis";
import { Credentials } from 'google-auth-library';

// Use Node.js runtime
export const runtime = 'nodejs';

// Environment variable validation
const requiredEnvVars = {
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
  PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT
};

Object.entries(requiredEnvVars).forEach(([name, value]) => {
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
});

// Initialize Pinecone client
console.log("[INIT] Initializing Pinecone client...");
const pineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});
console.log("[INIT] Pinecone client initialized");

// Initialize embeddings
console.log("[INIT] Initializing Gemini embeddings...");
const embeddingsClient = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY || "",
  modelName: "embedding-001"
});
console.log("[INIT] Gemini embeddings initialized");

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

interface ProcessedEmail {
  id: string;
  content: string;
  type: string;
  categories: string[];
  metadata: {
    emailId: string;
    threadId: string;
    from: string;
    subject: string;
    date: string;
    type: string;
    userId: string;
  };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

async function ingestEmails(userId: string): Promise<ProcessedEmail[]> {
  console.log(`[ingestEmails] Starting email ingestion for user ${userId}`);
  
  // Get Gmail tokens
  console.log('[ingestEmails] Fetching Gmail tokens...');
  const tokenDoc = await adminDb.collection('gmail_tokens').doc(userId).get();
  const tokens = tokenDoc.data() as TokenResponse | undefined;
  
  if (!tokens) {
    console.log('[ingestEmails] No Gmail tokens found - user not connected');
    throw new Error("Gmail not connected");
  }

  // Set up Gmail API
  console.log('[ingestEmails] Setting up Gmail client...');
  oauth2Client.setCredentials(tokens);
  
  const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client
  });

  // Get list of emails
  console.log('[ingestEmails] Fetching emails...');
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 50 // Fetch more emails for better context
  });

  if (!response.data.messages) {
    console.log('[ingestEmails] No emails found in inbox');
    return [];
  }

  console.log(`[ingestEmails] Found ${response.data.messages.length} emails to process`);
  const emails = response.data.messages;
  const processedEmails: ProcessedEmail[] = [];
  const index = pineconeClient.index(process.env.PINECONE_INDEX || "");

  // Process each email
  console.log('[ingestEmails] Starting to process individual emails...');
  for (const email of emails) {
    try {
      console.log(`[ingestEmails] Processing email ID: ${email.id}`);
      
      const messageData = await gmail.users.messages.get({
        userId: 'me',
        id: email.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date', 'To', 'Cc', 'Importance', 'List-Id']
      });

      const headers = messageData.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const cc = headers.find(h => h.name === 'Cc')?.value || '';
      const importance = headers.find(h => h.name === 'Importance')?.value || 'normal';
      const listId = headers.find(h => h.name === 'List-Id')?.value || '';

      // Create a rich metadata summary that's useful for the agent
      const summary = `
Subject: ${subject}
From: ${from}
To: ${to}
Date: ${date}
${cc ? `CC: ${cc}\n` : ''}${importance !== 'normal' ? `Importance: ${importance}\n` : ''}${listId ? `Mailing List: ${listId}` : ''}

This email was sent by ${from} on ${date}. ${importance !== 'normal' ? `It was marked as ${importance} importance. ` : ''}${cc ? `Other recipients were CC'd: ${cc}. ` : ''}${listId ? `This is part of the mailing list: ${listId}` : ''}
`.trim();

      // Create embedding for the email metadata
      console.log('[ingestEmails] Generating embedding...');
      const embedding = await embeddingsClient.embedQuery(summary);

      // Store in Pinecone with rich metadata
      await index.upsert([{
        id: `email-${email.id}`,
        values: embedding,
        metadata: {
          emailId: email.id || '',
          threadId: messageData.data.threadId || '',
          from,
          to,
          cc,
          subject,
          date,
          importance,
          listId,
          type: 'email',
          userId,
          text: summary,
          categories: ['Emails'],
          contentType: 'email',
          createdAt: new Date().toISOString(),
          // Add parsed date for better filtering
          timestamp: new Date(date).getTime(),
          // Add flags for quick filtering
          hasCC: !!cc,
          isImportant: importance === 'high',
          isMailingList: !!listId
        }
      }]);

      processedEmails.push({
        id: email.id || '',
        content: summary,
        type: 'email',
        categories: ['Emails'],
        metadata: {
          emailId: email.id || '',
          threadId: messageData.data.threadId || '',
          from,
          subject,
          date,
          type: 'email',
          userId
        }
      });
      
      console.log(`[ingestEmails] Successfully processed email ID: ${email.id}`);
    } catch (_error) {
      console.error(`[ingestEmails] Error processing email ${email.id}:`, _error);
      continue;
    }
  }

  console.log(`[ingestEmails] Completed processing ${processedEmails.length} emails`);
  return processedEmails;
}

interface ProcessedEvent {
  id: string;
  content: string;
  type: string;
  categories: string[];
  metadata: {
    eventId: string;
    summary: string;
    start: string;
    end: string;
    type: string;
    userId: string;
  };
}

interface CalendarEventMetadata extends Record<string, string | number | boolean | string[]> {
  type: string;
  eventId: string;
  summary: string;
  start: string;
  end: string;
  location: string;
  description: string;
  attendeeCount: number;
  isRecurring: boolean;
  userId: string;
}

async function ingestCalendarEvents(userId: string): Promise<ProcessedEvent[]> {
  console.log(`[ingestCalendarEvents] Starting calendar ingestion for user ${userId}`);
  
  // Get Calendar tokens
  console.log('[ingestCalendarEvents] Fetching Calendar tokens...');
  const tokenDoc = await adminDb.collection('calendar_tokens').doc(userId).get();
  const tokens = tokenDoc.data() as Credentials | undefined;
  
  if (!tokens) {
    console.log('[ingestCalendarEvents] No Calendar tokens found - user not connected');
    throw new Error("Calendar not connected");
  }

  // Set up Calendar API
  console.log('[ingestCalendarEvents] Setting up Calendar client...');
  oauth2Client.setCredentials(tokens);
  
  const calendar = google.calendar({
    version: 'v3',
    auth: oauth2Client
  });

  // Get time range for events
  const now = new Date();
  const pastWeek = new Date(now);
  pastWeek.setDate(pastWeek.getDate() - 7);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Get list of events
  console.log('[ingestCalendarEvents] Fetching events...');
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: pastWeek.toISOString(),
    timeMax: nextWeek.toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime'
  });

  if (!response.data.items) {
    console.log('[ingestCalendarEvents] No events found');
    return [];
  }

  console.log(`[ingestCalendarEvents] Found ${response.data.items.length} events to process`);
  const events = response.data.items;
  const processedEvents: ProcessedEvent[] = [];
  const index = pineconeClient.index(process.env.PINECONE_INDEX || "");

  // Process each event
  console.log('[ingestCalendarEvents] Starting to process individual events...');
  for (const event of events) {
    try {
      console.log(`[ingestCalendarEvents] Processing event: ${event.summary}`);
      
      // Create a rich metadata summary
      const summary = `
Event: ${event.summary}
Time: ${event.start?.dateTime || event.start?.date} to ${event.end?.dateTime || event.end?.date}
${event.location ? `Location: ${event.location}\n` : ''}${event.attendees ? `Attendees: ${event.attendees.length}\n` : ''}${event.recurrence ? 'Recurring: Yes\n' : ''}${event.description ? `Description: ${event.description}\n` : ''}
`.trim();

      // Create embedding for the event metadata
      console.log('[ingestCalendarEvents] Generating embedding...');
      const embedding = await embeddingsClient.embedQuery(summary);

      const metadata: CalendarEventMetadata = {
        type: 'calendar',
        eventId: event.id || '',
        summary: event.summary || '',
        start: (event.start?.dateTime || event.start?.date || '').toString(),
        end: (event.end?.dateTime || event.end?.date || '').toString(),
        location: event.location || '',
        description: event.description || '',
        attendeeCount: event.attendees?.length || 0,
        isRecurring: !!event.recurrence,
        userId
      };

      // Store in Pinecone with proper metadata types
      await index.upsert([{
        id: `calendar-${event.id}`,
        values: embedding,
        metadata
      }]);

      processedEvents.push({
        id: event.id!,
        content: summary,
        type: 'calendar',
        categories: ['Calendar'],
        metadata: {
          eventId: event.id!,
          summary: event.summary || '',
          start: (event.start?.dateTime || event.start?.date || '').toString(),
          end: (event.end?.dateTime || event.end?.date || '').toString(),
          type: 'calendar',
          userId
        }
      });
    } catch (_error) {
      console.error(`[ingestCalendarEvents] Error processing event ${event.id}:`, _error);
    }
  }

  return processedEvents;
}

/**
 * Sanitizes text to ensure it's valid UTF-8 and removes problematic characters
 */
function sanitizeText(text: string): string {
  // Replace null characters and other control characters
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Replace non-printable characters outside standard ASCII
  sanitized = sanitized.replace(/[\x80-\x9F]/g, '');
  
  // Remove any remaining binary garbage by enforcing valid UTF-8
  sanitized = sanitized
    .split('')
    .filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 || [9, 10, 13].includes(code); // Allow tab, newline, carriage return
    })
    .join('');
  
  // Normalize whitespace (multiple spaces/newlines to single)
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim excess whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * into Pinecone using Gemini embeddings for retrieval.
 */
export async function POST(req: NextRequest) {
  try {
    console.log("[POST] Starting document ingestion process...");

    // Authenticate user
    console.log("[POST] Checking authentication...");
    const { userId } = await auth();
    if (!userId) {
      console.log("[POST] Authentication failed - no userId found");
      return new Response(JSON.stringify({ 
        error: "Unauthorized: Please sign in to process documents" 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log(`[POST] User authenticated: ${userId}`);

    // Check if request can be parsed
    let data;
    try {
      data = await req.json();
      console.log("[POST] Request data parsed successfully");
    } catch (_error) {
      console.error("[POST] Failed to parse request data:", _error);
      return new Response(JSON.stringify({ 
        error: "Invalid request: Could not parse JSON data" 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle email ingestion if specified
    if (data.type === 'email') {
      console.log("[POST] Email ingestion requested, checking Gmail connection...");
      
      // Check if Gmail is connected first
      const tokenDoc = await adminDb.collection('gmail_tokens').doc(userId).get();
      if (!tokenDoc.exists) {
        console.log("[POST] Gmail not connected for user");
        return new Response(JSON.stringify({ 
          error: "Gmail not connected. Please connect your Gmail account first." 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.log("[POST] Gmail tokens found, proceeding with email ingestion");
      
      try {
        const processedEmails = await ingestEmails(userId);
        console.log(`[POST] Successfully processed ${processedEmails.length} emails`);
        
        data.content = processedEmails.map(email => email.content).join('\n\n');
        data.metadata = {
          ...data.metadata,
          type: 'email',
          categories: ['Emails'],
          emailCount: processedEmails.length
        };
      } catch (_error) {
        console.error("[POST] Email ingestion failed:", _error);
        return new Response(JSON.stringify({ 
          error: `Email ingestion failed: ${_error instanceof Error ? _error.message : 'Unknown error'}` 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle calendar ingestion if specified
    if (data.type === 'calendar') {
      console.log("[POST] Calendar ingestion requested, checking Calendar connection...");
      
      // Check if Calendar is connected first
      const tokenDoc = await adminDb.collection('calendar_tokens').doc(userId).get();
      if (!tokenDoc.exists) {
        console.log("[POST] Calendar not connected for user");
        return new Response(JSON.stringify({ 
          error: "Calendar not connected. Please connect your Calendar account first." 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.log("[POST] Calendar tokens found, proceeding with calendar ingestion");
      
      try {
        const processedEvents = await ingestCalendarEvents(userId);
        console.log(`[POST] Successfully processed ${processedEvents.length} events`);
        
        data.content = processedEvents.map(event => event.content).join('\n\n');
        data.metadata = {
          ...data.metadata,
          type: 'calendar',
          categories: ['Calendar'],
          eventCount: processedEvents.length
        };
      } catch (_error) {
        console.error("[POST] Calendar ingestion failed:", _error);
        return new Response(JSON.stringify({ 
          error: `Calendar ingestion failed: ${_error instanceof Error ? _error.message : 'Unknown error'}` 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Debug logs for content
    console.log('[POST] Document data details:', {
      hasContent: !!data.content,
      contentLength: data.content?.length,
      contentType: typeof data.content,
      metadata: data.metadata
    });

    // Validate and sanitize content
    if (!data.content || typeof data.content !== 'string') {
      console.log("[POST] Invalid content:", { 
        content: data.content, 
        type: typeof data.content 
      });
      return new Response(JSON.stringify({ 
        error: "Invalid content: Content must be a string" 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sanitizedContent = sanitizeText(data.content);
    
    if (sanitizedContent.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Empty content after sanitization" 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Size validation (10MB text limit)
    const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
    if (sanitizedContent.length > MAX_CONTENT_SIZE) {
      return new Response(JSON.stringify({ 
        error: `Content size exceeds maximum limit of ${MAX_CONTENT_SIZE / (1024 * 1024)}MB` 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing document with ${sanitizedContent.length} characters`);

    // Create document ID and metadata
    const documentId = `doc-${userId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Initialize text splitter for chunking
    console.log("Initializing text splitter...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Split text into chunks
    console.log("Splitting document into chunks...");
    const chunks = await textSplitter.createDocuments([sanitizedContent]);
    console.log(`Created ${chunks.length} chunks`);

    // Process each chunk
    console.log("Processing chunks and generating embeddings...");
    const vectors = await Promise.all(chunks.map(async (chunk, i) => {
      const embedding = await embeddingsClient.embedQuery(chunk.pageContent);
      
      // Determine if content is financial based on categories or content
      const isFinancial = (data.metadata?.categories || []).some((cat: string) => 
        cat.toLowerCase().includes('finance') || 
        cat.toLowerCase().includes('financial') ||
        cat.toLowerCase() === 'bank' ||
        cat.toLowerCase().includes('transaction')
      );

      // Enhanced metadata with financial indicators
      const enhancedMetadata = {
        text: chunk.pageContent,
        userId,
        documentId,
        chunkIndex: i,
        categories: data.metadata?.categories || ['document'],
        access: data.metadata?.access || 'personal',
        type: isFinancial ? 'financial_data' : 'document',
        contentType: isFinancial ? 'financial_data' : (data.type || 'document'),
        uploadedAt: timestamp,
        processingStartedAt: timestamp,
        originalFileName: data.metadata?.originalFileName,
        fileType: data.metadata?.fileType,
        fileSize: data.metadata?.fileSize,
        extractedAt: data.metadata?.extractedAt,
        source: data.source || 'user-input',
        
        // Add financial-specific metadata if relevant
        ...(isFinancial && {
          isFinancial: true,
          domain: "finance",
          category: "finance",
          financialCategory: "finances",
          transactionType: "bank_statement",
          primaryCategory: "finances",
          secondaryCategories: ["financial_data", "bank_records"],
          contextId: "finances"
        }),

        // Preserve any other custom metadata
        ...data.metadata
      };
      
      return {
        id: `${documentId}-chunk-${i}`,
        values: embedding,
        metadata: enhancedMetadata
      };
    }));

    // Store vectors in Pinecone
    console.log("[POST] Preparing to store vectors in Pinecone...");
    try {
      const pineconeIndex = pineconeClient.index(process.env.PINECONE_INDEX || "");
      console.log(`[POST] Using Pinecone index: ${process.env.PINECONE_INDEX}`);
      console.log(`[POST] Attempting to store ${vectors.length} vectors`);
      
      await pineconeIndex.upsert(vectors);
      console.log("[POST] Successfully stored vectors in Pinecone");
    } catch (_error) {
      console.error("[POST] Failed to store vectors in Pinecone:", _error);
      throw _error;
    }

    console.log(`[POST] Successfully processed document: ${documentId}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      documentId,
      metadata: {
        categories: data.metadata?.categories || ['document'],
        access: data.metadata?.access || 'personal',
        uploadedAt: timestamp,
        contentType: data.type || 'document',
        chunkCount: chunks.length
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (_error) {
    console.error('[POST] Error processing document:', _error);
    console.error('[POST] Error stack:', _error instanceof Error ? _error.stack : 'No stack trace available');
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: _error instanceof Error ? _error.message : 'Unknown error',
      details: _error instanceof Error ? _error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
