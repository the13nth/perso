import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import * as XLSX from 'xlsx';
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { processPDF } from "@/app/lib/utils/pdfUtils";

// Maximum file size - set to effectively unlimited
const MAX_FILE_SIZE = Number.MAX_SAFE_INTEGER;

// Supported file types
const SUPPORTED_EXTENSIONS = new Set(['.txt', '.pdf', '.xlsx', '.xls']);

// Next.js 13+ API routes don't use this config object anymore
// The bodyParser is handled automatically
export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in to upload documents" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size (${Math.round(file.size/1024)}KB) exceeds the ${Math.round(MAX_FILE_SIZE/1024)}KB limit` },
        { status: 400 }
      );
    }

    // Get file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Supported types: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}` },
        { status: 400 }
      );
    }

    // Create temp file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = join('/tmp', `upload-${Date.now()}${ext}`);
    await writeFile(tempFilePath, buffer);

    let text = '';
    let metadata = {};

    // Process based on file type
    if (ext === '.pdf') {
      const result = await processPDF(buffer);
      text = result.text;
      metadata = result.metadata;
    } else if (ext === '.txt') {
      // Read text file line by line
      const fileStream = createReadStream(tempFilePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const lines = [];
      for await (const line of rl) {
        lines.push(line);
      }
      text = lines.join('\n');
      metadata = {
        title: file.name,
        pageCount: 1
      };
    } else if (ext === '.xlsx' || ext === '.xls') {
      // Read Excel file
      const workbook = XLSX.readFile(tempFilePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      text = XLSX.utils.sheet_to_csv(worksheet);
      metadata = {
        title: file.name,
        sheetCount: workbook.SheetNames.length,
        sheets: workbook.SheetNames
      };
    }

    // Clean up temp file
    if (tempFilePath) {
      await unlink(tempFilePath);
    }

    return NextResponse.json({
      text,
      metadata: {
        ...metadata,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        extractedAt: new Date().toISOString()
      }
    });

  } catch (_error) {
    console.error('Error extracting text:', _error);
    
    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Failed to extract text from document" },
      { status: 500 }
    );
  }
}


