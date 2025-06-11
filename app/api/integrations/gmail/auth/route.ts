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
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://mail.google.com/'
];

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Generate OAuth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: userId,
      include_granted_scopes: false,
      prompt: 'consent',
      login_hint: 'gmail_integration'
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