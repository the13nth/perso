import { google } from 'googleapis';

export class GoogleCalendarService {
  private oauth2Client;

  constructor() {
    console.log('Initializing GoogleCalendarService');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Ensure this matches exactly what's configured in Google Cloud Console
    const redirectUri = `${baseUrl}/api/integrations/calendar/debug/callback`;
    
    console.log('OAuth Config:', {
      baseUrl,
      redirectUri,
      clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set'
    });

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar'
    ];

    console.log('Generating auth URL with scopes:', scopes);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true
    });

    console.log('Generated auth URL:', authUrl);
    return authUrl;
  }

  async getTokens(code: string) {
    console.log('Getting tokens for code:', code);
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log('Received tokens:', {
        access_token: tokens.access_token ? 'Present' : 'Missing',
        refresh_token: tokens.refresh_token ? 'Present' : 'Missing',
        expiry_date: tokens.expiry_date
      });
      return tokens;
    } catch (_error) {
      console.error('Error getting tokens:', _error);
      throw new Error('Failed to get access tokens from Google');
    }
  }

  async testConnection(accessToken: string) {
    console.log('Testing connection with access token');
    this.oauth2Client.setCredentials({ access_token: accessToken });

    try {
      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      // Try to get a single event to test the connection
      const response = await calendar.events.list({
        calendarId: 'primary',
        maxResults: 1,
      });

      console.log('Test connection successful:', {
        hasItems: !!response.data.items?.length,
        nextPageToken: !!response.data.nextPageToken
      });

      return {
        success: true,
        data: response.data
      };
    } catch (_error) {
      console.error('Test connection failed:', _error);
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Unknown error'
      };
    }
  }
} 