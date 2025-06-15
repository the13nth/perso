import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get filename from query
    const fileName = request.nextUrl.searchParams.get("fileName");
    if (!fileName) {
      return NextResponse.json(
        { error: "fileName parameter is required" },
        { status: 400 }
      );
    }

    // Get document metadata from Firestore
    const docRef = adminDb.collection("documentMetadata")
      .where("userId", "==", userId)
      .where("fileName", "==", fileName)
      .limit(1);

    const snapshot = await docRef.get();
    
    if (snapshot.empty) {
      return NextResponse.json(
        { metadata: null },
        { status: 200 }
      );
    }

    const metadata = snapshot.docs[0].data();
    return NextResponse.json({ metadata });

  } catch (error) {
    console.error("Error fetching document metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch document metadata" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get filename from request body
    const body = await request.json();
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // Find and delete document metadata
    const docRef = adminDb.collection("documentMetadata")
      .where("userId", "==", userId)
      .where("fileName", "==", fileName)
      .limit(1);

    const snapshot = await docRef.get();
    
    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Document metadata not found" },
        { status: 404 }
      );
    }

    // Delete the document
    await snapshot.docs[0].ref.delete();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting document metadata:", error);
    return NextResponse.json(
      { error: "Failed to delete document metadata" },
      { status: 500 }
    );
  }
} 