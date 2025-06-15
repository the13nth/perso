import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch data from collections
    const [notesSnap, activitiesSnap] = await Promise.all([
      adminDb.collection('notes')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get(),
      adminDb.collection('activities')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get()
    ]);

    // Process the data
    const notes = notesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis() || null,
      updatedAt: doc.data().updatedAt?.toMillis() || null
    }));

    const activities = activitiesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis() || null,
      updatedAt: doc.data().updatedAt?.toMillis() || null
    }));

    return NextResponse.json({
      notes,
      activities
    });

  } catch (error) {
    console.error('Error fetching Firebase data:', error);
    return NextResponse.json(
      { 
        error: "Failed to fetch data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 