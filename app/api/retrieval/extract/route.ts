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
          
          // Try multiple methods to parse PDF, particularly for Netlify deployment
          let pdfText = "";
          let parsingMethod = ""; // For debugging
          
          try {
            // Try multiple ways to parse the PDF
            const methods = [
              // Method 1: Try dynamic ES module import 
              async () => {
                const module = await import('pdf-parse/lib/pdf-parse.js');
                const pdfData = await module.default(buffer);
                parsingMethod = "ES module dynamic import";
                return pdfData.text;
              },
              
              // Method 2: Try using the CJS helper file
              async () => {
                try {
                  // @ts-ignore - We know this is a CommonJS module
                  const pdfParserCjs = require('./pdfparser.cjs');
                  const pdfData = await pdfParserCjs.parsePdf(buffer);
                  parsingMethod = "CommonJS helper file";
                  return pdfData.text;
                } catch (err) {
                  console.log("Error using CJS helper, trying Node.js path:", err);
                  
                  // Try finding the module directly in node_modules (Netlify specific)
                  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules/pdf-parse/lib/pdf-parse.js');
                  if (fs.existsSync(nodeModulesPath)) {
                    // @ts-ignore - Dynamic require
                    const pdfParse = require(nodeModulesPath);
                    const pdfData = await pdfParse(buffer);
                    parsingMethod = "Direct node_modules path";
                    return pdfData.text;
                  }
                  throw err;
                }
              },
              
              // Method 3: Try direct package import
              async () => {
                const module = await import('pdf-parse');
                const pdfData = await module.default(buffer);
                parsingMethod = "Direct package import";
                return pdfData.text;
              },
              
              // Method 4: Try CommonJS require directly
              async () => {
                // @ts-ignore - Using require in TypeScript
                const pdfParse = require('pdf-parse/lib/pdf-parse');
                const pdfData = await pdfParse(buffer);
                parsingMethod = "CommonJS require";
                return pdfData.text;
              }
            ];
            
            // Try each method in sequence until one works
            for (const method of methods) {
              try {
                pdfText = await method();
                // If we got here, method worked
                break;
              } catch (err: any) {
                // Method failed, continue to next
                console.log(`PDF parsing method failed: ${err.message}`);
              }
            }
            
            if (!pdfText) {
              throw new Error("All PDF parsing methods failed");
            }
            
            extractedText += `Content (parsed using ${parsingMethod}):\n${pdfText}`;
            
          } catch (parseError) {
            console.error("All PDF parsing methods failed:", parseError);
            
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