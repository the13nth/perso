import { db } from '../config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';

// Collection reference
const documentsCollection = collection(db, 'documents');

export interface DocumentMetadata {
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
  categories: string[];
  access: 'public' | 'personal';
  processingError?: string;
  embeddings?: {
    status: 'pending' | 'completed' | 'error';
    count: number;
    error?: string;
    completedAt?: Date;
  };
}

export interface DocumentContent {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

// Save document to Firestore
export async function saveDocument(document: DocumentContent) {
  const docRef = doc(documentsCollection, document.id);
  await setDoc(docRef, {
    ...document,
    metadata: {
      ...document.metadata,
      uploadedAt: document.metadata.uploadedAt.toISOString(),
      embeddings: {
        status: 'pending',
        count: 0
      }
    }
  });
}

// Get document by ID
export async function getDocument(documentId: string): Promise<DocumentContent | null> {
  const docRef = doc(documentsCollection, documentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as DocumentContent;
  return {
    ...data,
    metadata: {
      ...data.metadata,
      uploadedAt: new Date(data.metadata.uploadedAt)
    }
  };
}

// Get documents by user ID
export async function getUserDocuments(userId: string): Promise<DocumentContent[]> {
  const q = query(documentsCollection, where('metadata.userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data() as DocumentContent;
    return {
      ...data,
      metadata: {
        ...data.metadata,
        uploadedAt: new Date(data.metadata.uploadedAt)
      }
    };
  });
}

// Update document status
export async function updateDocumentStatus(
  documentId: string,
  status: DocumentMetadata['status'],
  error?: string
) {
  const docRef = doc(documentsCollection, documentId);
  await updateDoc(docRef, {
    'metadata.status': status,
    'metadata.processingError': error || null
  });
}

// Update embeddings status
export async function updateEmbeddingsStatus(
  documentId: string,
  status: DocumentMetadata['embeddings']['status'],
  count?: number,
  error?: string
) {
  const docRef = doc(documentsCollection, documentId);
  const update: any = {
    'metadata.embeddings.status': status
  };
  
  if (count !== undefined) {
    update['metadata.embeddings.count'] = count;
  }
  if (error !== undefined) {
    update['metadata.embeddings.error'] = error;
  }
  if (status === 'completed') {
    update['metadata.embeddings.completedAt'] = new Date().toISOString();
  }
  
  await updateDoc(docRef, update);
} 