import { NextRequest, NextResponse } from 'next/server';
import { getUserContexts } from '@/lib/pinecone';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const contexts = await getUserContexts(userId);
    return NextResponse.json({ contexts });
  } catch (error) {
    console.error('Error fetching contexts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contexts' },
      { status: 500 }
    );
  }
} 