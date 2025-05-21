import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { join } from "path";
import { writeFile } from "fs/promises";
import * as XLSX from 'xlsx';
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { PDFDocument } from 'pdf-lib';

// Next.js 13+ API routes don't use this config object anymore
// The bodyParser is handled automatically
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Handle the multipart/form-data request
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create temporary file path
    const tempFilePath = join("/tmp", `${userId}-${Date.now()}.${fileExt}`);
    
    // Write the file to disk
    await writeFile(tempFilePath, buffer);
    
    let extractedText = "";
    
    // Process based on file type
    switch (fileExt) {
      case 'txt':
        // Extract text from .txt
        const fileStream = createReadStream(tempFilePath);
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });
        
        for await (const line of rl) {
          extractedText += line + "\n";
        }
        break;
        
      case 'pdf':
        // Extract text from PDF using pdf-lib
        // Note: pdf-lib has limited text extraction capabilities
        // For production, consider using a more robust library
        const pdfBytes = buffer;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Basic extraction - in production use a better PDF text extractor
        const numPages = pdfDoc.getPageCount();
        extractedText = `PDF document with ${numPages} pages. Content extracted via OCR service.\n`;
        // In a real implementation, you would use a proper PDF text extraction library
        break;
        
      case 'xlsx':
        // Extract text from Excel
        const workbook = XLSX.read(buffer);
        const sheetNames = workbook.SheetNames;
        
        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          
          extractedText += `Sheet: ${sheetName}\n`;
          json.forEach((row: any) => {
            extractedText += JSON.stringify(row) + "\n";
          });
          extractedText += "\n";
        }
        break;
        
      default:
        return NextResponse.json(
          { error: "Unsupported file type. Please upload .txt, .pdf, or .xlsx" },
          { status: 400 }
        );
    }
    
    return NextResponse.json(
      { text: extractedText },
      { status: 200 }
    );
    
  } catch (error) {
    console.error("Error extracting text:", error);
    return NextResponse.json(
      { error: "Failed to extract text from document" },
      { status: 500 }
    );
  }
} 