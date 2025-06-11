import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase/admin";
import { refreshTokenIfNeeded } from "@/lib/services/googleAuth";
import { Credentials } from 'google-auth-library';

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Function to get events from the past week and upcoming week
function getTimeRange() {
  const now = new Date();
  const pastWeek = new Date(now);
  pastWeek.setDate(pastWeek.getDate() - 7);
  
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  return {
    timeMin: pastWeek.toISOString(),
    timeMax: nextWeek.toISOString(),
    description: `${pastWeek.toLocaleDateString()} to ${nextWeek.toLocaleDateString()}`
  };
}

// Fetch calendar events with proper scopes
export async function GET() {
  try {
    console.log("[DEBUG] Starting calendar events fetch...");
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Calendar tokens with automatic refresh
    console.log("[DEBUG] Fetching and refreshing Calendar tokens if needed...");
    try {
      const tokens = await refreshTokenIfNeeded(oauth2Client, userId, 'calendar_tokens');
      oauth2Client.setCredentials(tokens);
    } catch (error) {
      console.error("[DEBUG] Token refresh failed:", error);
      return NextResponse.json({ error: "Calendar not connected" }, { status: 400 });
    }
    
    // Set up Calendar API
    console.log("[DEBUG] Setting up Calendar client...");
    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    // Get time range for events
    const { timeMin, timeMax, description: timeRange } = getTimeRange();

    // Fetch events with retries
    console.log("[DEBUG] Fetching events...");
    let retries = 3;
    let response;
    while (retries > 0) {
      try {
        response = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          maxResults: 100,
          singleEvents: true,
          orderBy: 'startTime'
        });
        break;
      } catch (_error) {
        console.error(`[DEBUG] Fetch attempt failed, ${retries - 1} retries left:`, _error);
        retries--;
        if (retries === 0) throw _error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!response?.data.items) {
      console.log("[DEBUG] No events found");
      return NextResponse.json({ 
        events: [],
        status: {
          totalEvents: 0,
          timeRange
        }
      });
    }

    // Process events to match the expected format
    const events = response.data.items.map(event => ({
      id: event.id,
      summary: event.summary || 'Untitled Event',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      attendees: event.attendees?.length || 0,
      description: event.description,
      location: event.location,
      status: event.status,
      isRecurring: !!event.recurrence
    }));

    return NextResponse.json({
      events,
      status: {
        totalEvents: events.length,
        timeRange
      }
    });

  } catch (_error) {
    console.error("[DEBUG] Error fetching calendar events:", _error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
} 