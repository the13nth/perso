import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { adminDb } from "@/lib/firebase/admin";

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/callback`
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains userId from auth step
    
    if (!code || !state) {
      throw new Error("Missing code or state parameter");
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens in Firestore
    await adminDb.collection('calendar_tokens').doc(state).set(tokens);

    // Return success page that closes the popup
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f3f4f6;
              color: #1f2937;
            }
            .success {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 0.5rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .icon {
              color: #22c55e;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="success">
            <div class="icon">✓</div>
            <h1>Calendar Connected Successfully</h1>
            <p>You can close this window now.</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `, {
      headers: {
        "Content-Type": "text/html",
      },
    });

  } catch (_error) {
    console.error("Error in Calendar callback:", _error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f3f4f6;
              color: #1f2937;
            }
            .error {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 0.5rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .icon {
              color: #ef4444;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <div class="icon">×</div>
            <h1>Connection Failed</h1>
            <p>There was an error connecting your Calendar.</p>
            <p>You can close this window and try again.</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `, {
      headers: {
        "Content-Type": "text/html",
      },
      status: 500
    });
  }
} 