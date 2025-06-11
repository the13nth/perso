import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase/admin";

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}



// Add token refresh logic

// Fetch emails with proper scopes
export async function GET() {
  try {
    console.log("[DEBUG] Starting email fetch...");
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Gmail tokens
    console.log("[DEBUG] Fetching Gmail tokens...");
    const tokenDoc = await adminDb.collection('gmail_tokens').doc(userId).get();
    const tokens = tokenDoc.data() as TokenResponse | undefined;
    
    if (!tokens) {
      console.log("[DEBUG] No Gmail tokens found");
      return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
    }

    // Set up Gmail API
    console.log("[DEBUG] Setting up Gmail client...");
    oauth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });

    // Fetch emails with retries
    console.log("[DEBUG] Fetching emails...");
    let retries = 3;
    let response;
    while (retries > 0) {
      try {
        response = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 20,
          labelIds: ['INBOX']  // Only fetch from inbox
        });
        break;
      } catch (_error) {
        console.error(`[DEBUG] Fetch attempt failed, ${retries - 1} retries left:`, _error);
        retries--;
        if (retries === 0) throw _error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!response?.data.messages) {
      console.log("[DEBUG] No emails found");
      return NextResponse.json({ emails: [] });
    }

    // Get email details with improved error handling
    console.log("[DEBUG] Fetching email details...");
    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        try {
          const messageData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date']
          });

          const headers = messageData.data.payload?.headers || [];
          return {
            id: message.id,
            subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
            from: headers.find(h => h.name === 'From')?.value || 'Unknown Sender',
            date: headers.find(h => h.name === 'Date')?.value || '',
            snippet: messageData.data.snippet || '',
            hasFullContent: false
          };
        } catch (_error) {
          console.error(`[DEBUG] Failed to fetch email ${message.id}:`, _error);
          return {
            id: message.id,
            subject: 'Error fetching email',
            from: 'Unknown',
            date: '',
            snippet: 'Failed to fetch email content',
            hasFullContent: false
          };
        }
      })
    );

    // Filter out failed emails
    const validEmails = emails.filter(email => email.subject !== 'Error fetching email');
    
    console.log(`[DEBUG] Successfully fetched ${validEmails.length} emails`);
    return NextResponse.json({ 
      emails: validEmails,
      status: {
        totalEmails: validEmails.length
      }
    });

  } catch (_error) {
    console.error("[DEBUG] Error fetching emails:", _error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
} 