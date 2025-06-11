import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OAuth2Client } from "google-auth-library";

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/callback`
);

// Calendar API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar'
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
      // Only prompt for consent if we don't have a valid refresh token
      prompt: 'select_account consent'
    });

    return NextResponse.json({ authUrl });
  } catch (_error) {
    console.error("Error initializing Calendar auth:", _error);
    return NextResponse.json(
      { error: "Failed to initialize Calendar authentication" },
      { status: 500 }
    );
  }
} 