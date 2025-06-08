import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  // For production (Netlify), use environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccountString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString();
      return JSON.parse(serviceAccountString);
    } catch (error) {
      console.error('Failed to parse service account from environment variable:', error);
      throw error;
    }
  }

  // For local development, try to read from file
  if (process.env.NODE_ENV === 'development') {
    try {
      // Using dynamic import for development only
      const serviceAccount = require('./credentials/service-account.json');
      return serviceAccount;
    } catch (error) {
      console.warn('No local service account file found');
      // In development, if no local file exists, try environment variable as fallback
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccountString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString();
        return JSON.parse(serviceAccountString);
      }
    }
  }
  
  throw new Error('No Firebase service account credentials found. Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide a service-account.json file in development.');
}

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(getServiceAccount())
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Initialize Firestore
const adminDb = getFirestore(getApps()[0]);

export { adminDb }; 