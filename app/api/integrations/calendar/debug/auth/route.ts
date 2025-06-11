import { NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/services/calendar/GoogleCalendarService';

export async function GET() {
  try {
    console.log('Debug: Initializing calendar service for auth');
    const calendarService = new GoogleCalendarService();
    const authUrl = calendarService.getAuthUrl();
    
    return NextResponse.json({ url: authUrl });
  } catch (_error) {
    console.error('Debug: Auth error:', _error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL', details: _error instanceof Error ? _error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 