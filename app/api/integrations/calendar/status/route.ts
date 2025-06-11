import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OAuth2Client } from "google-auth-library";
import { adminDb } from "@/lib/firebase/admin";

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/callback`
);

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tokens from Firestore
    const tokenDoc = await adminDb.collection('calendar_tokens').doc(userId).get();
    const tokens = tokenDoc.data() as TokenResponse | undefined;
    
    if (!tokens) {
      return NextResponse.json({
        connected: false
      });
    }

    // Set the credentials and verify them
    oauth2Client.setCredentials(tokens);
    
    try {
      // Verify the tokens are still valid
      await oauth2Client.getTokenInfo(tokens.access_token);
      return NextResponse.json({
        connected: true
      });
    } catch (_error) {
      // Token is invalid or expired
      await adminDb.collection('calendar_tokens').doc(userId).delete();
      return NextResponse.json({
        connected: false
      });
    }
  } catch (_error) {
    return NextResponse.json({
      connected: false,
      message: "Not connected to Google Calendar"
    });
  }
} 