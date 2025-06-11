import { NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/services/calendar/GoogleCalendarService';

export async function GET(request: Request) {
  console.log('Debug: Testing calendar connection');
  
  const token = request.headers.get('X-Calendar-Token');
  
  if (!token) {
    console.error('Debug: No token provided for test');
    return NextResponse.json(
      { error: 'No token provided' },
      { status: 400 }
    );
  }

  try {
    const calendarService = new GoogleCalendarService();
    const result = await calendarService.testConnection(token);
    
    return NextResponse.json(result);
  } catch (_error) {
    console.error('Debug: Test connection error:', _error);
    return NextResponse.json(
      { error: 'Test failed', details: _error instanceof Error ? _error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 