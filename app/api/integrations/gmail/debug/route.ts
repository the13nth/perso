import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase/admin";
import { refreshTokenIfNeeded } from "@/lib/services/googleAuth";

// Initialize OAuth2 client with proper scopes
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Required Gmail scopes - update your OAuth setup to include these
const REQUIRED_SCOPES = [
  'https://mail.google.com/',           // Full Gmail access
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

interface MessageHeader {
  name: string | null;
  value: string | null;
}

// Helper function to decode base64 URL-safe strings
function base64UrlDecode(input: string) {
  try {
    // Replace URL-safe characters
    input = input.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const pad = input.length % 4;
    if (pad) {
      input += '='.repeat(4 - pad);
    }
    return Buffer.from(input, 'base64').toString('utf-8');
  } catch (error) {
    console.error('Error decoding base64:', error);
    return '';
  }
}

// Function to recursively extract text content from email parts
function extractTextContent(part: any): string {
  let content = '';
  
  // Check if this part contains text content
  if (part.mimeType === 'text/plain' && part.body?.data) {
    content += base64UrlDecode(part.body.data);
  } else if (part.mimeType === 'text/html' && part.body?.data) {
    // You might want to strip HTML tags here
    content += base64UrlDecode(part.body.data);
  }
  
  // Recursively process sub-parts
  if (part.parts) {
    for (const subPart of part.parts) {
      content += extractTextContent(subPart);
    }
  }
  
  return content;
}

// Helper function to extract email body with improved error handling
async function getEmailBody(gmail: any, messageId: string) {
  try {
    // Get the full message content
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'  // This now works with gmail.readonly scope
    });

    if (!message.data) {
      throw new Error('No message data received');
    }

    const payload = message.data.payload;
    let body = '';

    // Extract body content
    if (payload) {
      body = extractTextContent(payload);
    }

    // Fallback to snippet if no body content found
    if (!body.trim()) {
      body = message.data.snippet || 'No content available';
    }

    // Get headers as a simple object
    const headers = payload?.headers?.reduce((acc: any, header: any) => {
      if (header.name && header.value) {
        acc[header.name.toLowerCase()] = header.value;
      }
      return acc;
    }, {}) || {};

    return {
      body: body.trim(),
      snippet: message.data.snippet || '',
      threadId: message.data.threadId,
      labelIds: message.data.labelIds || [],
      headers,
      mimeType: payload?.mimeType,
      hasAttachments: payload?.parts?.some((part: any) => 
        part.filename && part.filename.length > 0
      ) || false,
      internalDate: message.data.internalDate,
      historyId: message.data.historyId
    };
  } catch (error) {
    console.error(`Error fetching email body for message ${messageId}:`, error);
    
    // If it's a scope error, provide a more helpful error message
    if (error instanceof Error && error.message.includes('scope')) {
      throw new Error(`Insufficient Gmail permissions. Please re-authenticate with broader scopes.`);
    }
    
    throw error;
  }
}

// Helper function to safely get header value
function getHeaderValue(headers: MessageHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

// Check if user has sufficient scopes
async function checkGmailScopes(gmail: any): Promise<boolean> {
  try {
    // Try to access a message with metadata to test permissions
    const testResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1
    });
    
    if (testResponse.data.messages && testResponse.data.messages.length > 0) {
      await gmail.users.messages.get({
        userId: 'me',
        id: testResponse.data.messages[0].id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject']
      });
    }
    
    return true;
  } catch (error) {
    console.error('Scope check failed:', error);
    return false;
  }
}

// Main GET handler
export async function GET() {
  try {
    console.log("[DEBUG] Starting email fetch...");
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Gmail tokens with automatic refresh
    console.log("[DEBUG] Fetching and refreshing Gmail tokens if needed...");
    let tokens;
    try {
      tokens = await refreshTokenIfNeeded(oauth2Client, userId, 'gmail_tokens');
      oauth2Client.setCredentials(tokens);
    } catch (error) {
      console.error("[DEBUG] Token refresh failed:", error);
      return NextResponse.json({ 
        error: "Gmail not connected. Please re-authenticate.",
        requiresAuth: true
      }, { status: 400 });
    }
    
    // Set up Gmail API
    console.log("[DEBUG] Setting up Gmail client...");
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });

    // Check if user has sufficient scopes
    console.log("[DEBUG] Checking Gmail permissions...");
    const hasSufficientScopes = await checkGmailScopes(gmail);
    if (!hasSufficientScopes) {
      return NextResponse.json({
        error: "Insufficient Gmail permissions. Please re-authenticate to grant read access to your emails.",
        requiresAuth: true,
        requiredScopes: REQUIRED_SCOPES
      }, { status: 403 });
    }

    // Fetch emails with retries
    console.log("[DEBUG] Fetching emails...");
    let retries = 3;
    let response;
    
    while (retries > 0) {
      try {
        response = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 20,
          labelIds: ['INBOX']
        });
        break;
      } catch (error) {
        console.error(`[DEBUG] Fetch attempt failed, ${retries - 1} retries left:`, error);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!response?.data.messages || response.data.messages.length === 0) {
      console.log("[DEBUG] No emails found");
      return NextResponse.json({ emails: [], total: 0 });
    }

    // Process emails in batches to avoid overwhelming the API
    const batchSize = 5;
    const emails = [];
    
    for (let i = 0; i < response.data.messages.length; i += batchSize) {
      const batch = response.data.messages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        if (!message.id) return null;
        
        try {
          // Get message metadata first
          const metadata = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date', 'To', 'Cc']
          });

          // Get full message content
          const content = await getEmailBody(gmail, message.id);
          if (!content) return null;

          const headers = metadata.data.payload?.headers as MessageHeader[] | undefined;
          
          return {
            id: message.id,
            from: getHeaderValue(headers, 'From'),
            to: getHeaderValue(headers, 'To'),
            cc: getHeaderValue(headers, 'Cc'),
            subject: getHeaderValue(headers, 'Subject') || '(No Subject)',
            receivedDate: getHeaderValue(headers, 'Date'),
            ...content
          };
        } catch (error) {
          console.error(`Error processing email ${message.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      emails.push(...batchResults.filter(Boolean));
      
      // Add small delay between batches to respect rate limits
      if (i + batchSize < response.data.messages.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[DEBUG] Successfully fetched ${emails.length} emails with content`);

    return NextResponse.json({ 
      emails,
      total: emails.length,
      hasMore: (response.data.resultSizeEstimate ?? 0) > 20
    });
    
  } catch (error) {
    console.error("[DEBUG] Error fetching emails:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('scope') || error.message.includes('permission')) {
        return NextResponse.json({
          error: "Insufficient Gmail permissions. Please re-authenticate with broader access.",
          requiresAuth: true
        }, { status: 403 });
      }
    }
    
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}