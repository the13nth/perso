import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OAuth2Client } from "google-auth-library";

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`
);

// Gmail API scopes we need
const SCOPES = [
  'https://mail.google.com/',  // Full email access including reading content
  'https://www.googleapis.com/auth/gmail.readonly',  // Read all resources
  'https://www.googleapis.com/auth/gmail.metadata',  // Read metadata
  'https://www.googleapis.com/auth/gmail.labels'     // Manage labels
];

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Generate OAuth URL with optimized configuration
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: userId,
      // Enable incremental authorization
      include_granted_scopes: true,
      // Force consent to ensure we get all permissions
      prompt: 'consent'
    });

    return NextResponse.json({ authUrl });
  } catch (_error) {
    console.error("Error initializing Gmail auth:", _error);
    return NextResponse.json(
      { error: "Failed to initialize Gmail authentication" },
      { status: 500 }
    );
  }
} 