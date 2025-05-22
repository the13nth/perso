import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { join } from "path";
import { writeFile, readFile, unlink } from "fs/promises";
import * as XLSX from 'xlsx';
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
// Use dynamic import for pdf-parse to support both ES Module and CommonJS environments
// import pdf-parse will be handled dynamically inside the PDF handling case

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
        try {
          // First, get metadata with pdf-lib
          const pdfDoc = await PDFDocument.load(buffer);
          const numPages = pdfDoc.getPageCount();
          
          // Get PDF metadata if available
          const title = pdfDoc.getTitle() || 'Untitled';
          const author = pdfDoc.getAuthor() || 'Unknown Author';
          const subject = pdfDoc.getSubject() || '';
          const keywords = pdfDoc.getKeywords() || '';
          
          // Create PDF summary with metadata
          extractedText += `PDF Document: ${title}\n`;
          extractedText += `Author: ${author}\n`;
          if (subject) extractedText += `Subject: ${subject}\n`;
          if (keywords) extractedText += `Keywords: ${keywords}\n`;
          extractedText += `Number of Pages: ${numPages}\n\n`;
          
          // Use the CJS helper for PDF parsing - this is designed to work on Netlify
          try {
            // Create a file URL for more reliable ES module imports
            const pdfParserPath = path.join(process.cwd(), 'app/api/retrieval/extract/pdfparser.cjs');
            const pdfParserUrl = `file://${pdfParserPath}`;
            
            // Try multiple import methods to ensure compatibility
            let pdfParserCjs;
            try {
              // Method 1: Try URL-based import with file protocol
              const pdfParserModule = await import(/* webpackIgnore: true */ pdfParserUrl);
              pdfParserCjs = pdfParserModule.default || pdfParserModule;
            } catch (importError) {
              console.log("URL import failed, trying direct path import:", importError);
              // Method 2: Try direct path import
              const pdfParserModule = await import(/* webpackIgnore: true */ pdfParserPath);
              pdfParserCjs = pdfParserModule.default || pdfParserModule;
            }
            
            const pdfData = await pdfParserCjs.parsePdf(buffer);
            extractedText += `Content:\n${pdfData.text}`;
          } catch (parseError) {
            console.error("PDF parsing failed:", parseError);
            
            // Fallback: Use our manual text extraction method
            extractedText += "Using manual text extraction method due to parser error.\n\n";
            const textChunks = [];
            for (let i = 0; i < buffer.length; i++) {
              // Look for readable ASCII text (letters, numbers, punctuation)
              if (buffer[i] >= 32 && buffer[i] <= 126) {
                let chunk = '';
                let j = i;
                // Collect consecutive ASCII characters
                while (j < buffer.length && buffer[j] >= 32 && buffer[j] <= 126) {
                  chunk += String.fromCharCode(buffer[j]);
                  j++;
                }
                // Only keep chunks that might be meaningful text (more than a few characters)
                if (chunk.length > 5) {
                  textChunks.push(chunk);
                }
                i = j;
              }
            }
            
            // Join the chunks and add to extracted text
            const rawText = textChunks.join(' ');
            if (rawText.length > 0) {
              extractedText += "Content (extracted manually):\n" + rawText;
            } else {
              extractedText += "Failed to extract any readable text from this PDF.";
            }
          }
        } catch (error) {
          console.error("Error extracting PDF text:", error);
          extractedText += "Error extracting complete text from PDF. Partial content may be available.\n";
        }
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
    
    // Clean up the temporary file
    try {
      await unlink(tempFilePath);
    } catch (unlinkError) {
      console.error("Error deleting temporary file:", unlinkError);
    }
    
    // Sanitize the extracted text to ensure it's clean UTF-8
    const sanitizedText = sanitizeText(extractedText);
    
    return NextResponse.json(
      { text: sanitizedText },
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

/**
 * Sanitizes text to ensure it's valid UTF-8 and removes problematic characters
 */
function sanitizeText(text: string): string {
  // Replace null characters and other control characters
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Replace non-printable characters outside standard ASCII
  sanitized = sanitized.replace(/[\x80-\x9F]/g, '');
  
  // Remove any remaining binary garbage by enforcing valid UTF-8
  sanitized = sanitized
    .split('')
    .filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 || [9, 10, 13].includes(code); // Allow tab, newline, carriage return
    })
    .join('');
  
  // Normalize whitespace (multiple spaces/newlines to single)
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim excess whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
} 