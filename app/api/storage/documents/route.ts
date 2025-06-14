import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase/admin";

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

    // Get Firebase Storage instance
    const storage = getStorage(adminDb.app);
    const bucket = storage.bucket();

    // List files in the user's directory
    const [files] = await bucket.getFiles({
      prefix: `users/${userId}/`,
    });

    // Transform file metadata into the required format
    const documents = await Promise.all(files.map(async (file) => {
      const [metadata] = await file.getMetadata();
      
      return {
        id: file.name,
        name: file.name.split('/').pop() || file.name,
        type: metadata.contentType || 'application/octet-stream',
        size: parseInt(String(metadata.size || '0')),
        createdAt: metadata.timeCreated,
        path: file.name,
      };
    }));

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
} 