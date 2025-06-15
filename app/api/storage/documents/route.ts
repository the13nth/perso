import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminStorage } from "@/lib/firebase/admin";

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
    try {
      // Check if bucket exists
      const [exists] = await adminStorage.exists();
      if (!exists) {
        console.error('Storage bucket does not exist');
        return NextResponse.json(
          { error: "Storage system not properly configured" },
          { status: 503 }
        );
      }

      // List files in the user's directory
      const [files] = await adminStorage.getFiles({
        prefix: `users/${userId}/`,
      });

      // If no files found, return empty array
      if (!files || files.length === 0) {
        return NextResponse.json({ 
          documents: [],
          message: "No documents found"
        });
      }

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
    } catch (bucketError: any) {
      // Handle specific bucket errors
      if (bucketError.code === 404) {
        console.error('Bucket not found:', bucketError);
        return NextResponse.json(
          { error: "Storage system not properly configured" },
          { status: 503 }
        );
      }
      throw bucketError; // Re-throw other errors to be caught by outer catch
    }
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
} 