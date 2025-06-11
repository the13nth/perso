import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/lib/firebase/admin";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove tokens from Firestore
    await adminDb.collection('calendar_tokens').doc(userId).delete();

    return NextResponse.json({ success: true });
  } catch (_error) {
    console.error("Error disconnecting calendar:", _error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
} 