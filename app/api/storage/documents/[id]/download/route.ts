import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStorage } from "firebase-admin/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params to get the document ID
    const { id: documentId } = await params;
    
    if (!documentId) {
      return Response.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Get Firebase Storage instance
    const storage = getStorage();
    const bucket = storage.bucket();
    const file = bucket.file(documentId);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return Response.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Generate signed URL for download
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // URL expires in 15 minutes
    });

    return Response.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return Response.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}