import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase/admin';

const REQUIRED_GMAIL_SCOPES = [
  // 'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  // 'https://www.googleapis.com/auth/gmail.metadata',
  // 'https://www.googleapis.com/auth/gmail.labels'
];

export async function refreshTokenIfNeeded(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  userId: string,
  collectionName: 'gmail_tokens' | 'calendar_tokens'
) {
  // Get current tokens
  const tokenDoc = await adminDb.collection(collectionName).doc(userId).get();
  const tokens = tokenDoc.data() as {
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };

  if (!tokens) {
    throw new Error('No tokens found');
  }

  // Check if we have all required scopes for Gmail
  if (collectionName === 'gmail_tokens') {
    const tokenScopes = tokens.scope.split(' ');
    const missingScopes = REQUIRED_GMAIL_SCOPES.filter(scope => {
      // Normalize scopes by trimming and converting to lowercase for comparison
      const normalizedScope = scope.trim().toLowerCase();
      return !tokenScopes.some(ts => ts.trim().toLowerCase() === normalizedScope);
    });
    
    if (missingScopes.length > 0) {
      console.error('Missing required scopes:', missingScopes);
      // Delete tokens to force re-authentication with correct scopes
      await adminDb.collection(collectionName).doc(userId).delete();
      throw new Error(`Missing required Gmail scopes: ${missingScopes.join(', ')}`);
    }
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  const expiryDate = tokens.expiry_date;
  const isExpired = expiryDate ? Date.now() >= expiryDate - 5 * 60 * 1000 : true;

  if (isExpired && tokens.refresh_token) {
    try {
      // Refresh the token
      oauth2Client.setCredentials(tokens);
      const { credentials: newTokens } = await oauth2Client.refreshAccessToken();
      
      // Preserve the refresh token if the new tokens don't include it
      if (!newTokens.refresh_token && tokens.refresh_token) {
        newTokens.refresh_token = tokens.refresh_token;
      }

      // Update tokens in database
      await adminDb.collection(collectionName).doc(userId).set(newTokens);
      
      return newTokens;
    } catch (error) {
      console.error('Error refreshing token:', error);
      // If refresh fails, delete the tokens to force re-authentication
      await adminDb.collection(collectionName).doc(userId).delete();
      throw new Error('Failed to refresh token');
    }
  }

  return tokens;
} 