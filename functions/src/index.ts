import * as functions from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Initialize Google Gen AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
  environment: process.env.PINECONE_ENVIRONMENT || ''
});

// Function to generate embeddings
async function generateEmbeddings(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding;
}

interface DocumentData {
  content: string;
  metadata: {
    userId: string;
    fileName: string;
    categories: string[];
    [key: string]: any;
  };
}

// Cloud Function triggered by document creation/update
export const processDocument = functions.firestore
  .document('documents/{documentId}')
  .onCreate(async (snap, context) => {
    const documentData = snap.data() as DocumentData;
    const documentId = context.params.documentId;

    try {
      // Update status to processing
      await db.doc(`documents/${documentId}`).update({
        'metadata.status': 'processing'
      });

      // Initialize text splitter
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      // Split text into chunks
      const chunks = await textSplitter.createDocuments([documentData.content]);

      // Get Pinecone index
      const index = pinecone.index(process.env.PINECONE_INDEX || '');

      // Process chunks and generate embeddings
      let embeddingsCount = 0;
      for (const chunk of chunks) {
        const embedding = await generateEmbeddings(chunk.pageContent);
        
        // Upsert to Pinecone
        await index.upsert([{
          id: `${documentId}-${embeddingsCount}`,
          values: embedding,
          metadata: {
            text: chunk.pageContent,
            documentId,
            userId: documentData.metadata.userId,
            category: documentData.metadata.categories[0] || 'general',
            source: documentData.metadata.fileName,
            chunkIndex: embeddingsCount
          }
        }]);
        
        embeddingsCount++;
      }

      // Update document status to completed
      await db.doc(`documents/${documentId}`).update({
        'metadata.status': 'completed',
        'metadata.embeddings': {
          status: 'completed',
          count: embeddingsCount,
          completedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error processing document:', error);
      
      // Update document status to error
      await db.doc(`documents/${documentId}`).update({
        'metadata.status': 'error',
        'metadata.processingError': error instanceof Error ? error.message : 'Unknown error',
        'metadata.embeddings': {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }); 