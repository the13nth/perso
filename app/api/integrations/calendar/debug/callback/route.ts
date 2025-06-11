import { NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/services/calendar/GoogleCalendarService';

export async function GET(request: Request) {
  console.log('Debug: Received callback request');
  
  // Get the authorization code from the URL
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    console.error('Debug: No code received in callback');
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/calendar/debug?error=no_code`
    );
  }

  try {
    console.log('Debug: Getting tokens with code');
    const calendarService = new GoogleCalendarService();
    const tokens = await calendarService.getTokens(code);
    
    // For security, we'll only pass the access token in the URL
    // The complete token object will be logged in the console
    const tokenData = encodeURIComponent(tokens.access_token || '');
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/calendar/debug?success=true#token=${tokenData}`
    );
  } catch (_error) {
    console.error('Debug: Callback error:', _error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/calendar/debug?error=callback_failed&details=${encodeURIComponent(_error instanceof Error ? _error.message : 'Unknown error')}`
    );
  }
} 