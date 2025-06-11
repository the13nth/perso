import { adminDb } from '@/lib/firebase/admin';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export async function getGoogleCalendarCredentials(userId: string): Promise<TokenResponse | null> {
  try {
    const tokenDoc = await adminDb.collection('calendar_tokens').doc(userId).get();
    const tokens = tokenDoc.data() as TokenResponse | undefined;
    return tokens || null;
  } catch (_error) {
    console.error('Error getting calendar credentials:', _error);
    return null;
  }
} 