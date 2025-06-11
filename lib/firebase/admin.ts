import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  });

  // For production (Netlify), use environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Attempting to use FIREBASE_SERVICE_ACCOUNT environment variable');
    try {
      // Try parsing directly first
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.log('Direct JSON parse failed, trying base64 decode');
      try {
        // If direct parse fails, try base64 decode
        const serviceAccountString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString();
        const parsed = JSON.parse(serviceAccountString);
        console.log('Successfully parsed service account from environment variable');
        return parsed;
      } catch (_error) {
        console.error('Failed to parse service account from environment variable:', _error);
        throw _error;
      }
    }
  }

  // For local development, try to read from file
  if (process.env.NODE_ENV === 'development') {
    console.log('Attempting to read service account from file');
    try {
      // Using dynamic import for development only
      const serviceAccount = require('./credentials/service-account.json');
      console.log('Successfully loaded service account from file');
      return serviceAccount;
    } catch (_error) {
      console.warn('No local service account file found:', _error);
      // In development, if no local file exists, try environment variable as fallback
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('Falling back to environment variable');
        try {
          return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (error) {
          const serviceAccountString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString();
          return JSON.parse(serviceAccountString);
        }
      }
    }
  }
  
  console.error('All attempts to load Firebase service account failed');
  throw new Error('No Firebase service account credentials found. Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide a service-account.json file in development.');
}

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  try {
    console.log('Initializing Firebase Admin');
    initializeApp({
      credential: cert(getServiceAccount())
    });
    console.log('Firebase Admin initialized successfully');
  } catch (_error) {
    console.error('Failed to initialize Firebase Admin:', _error);
    throw _error;
  }
}

// Initialize Firestore
const adminDb = getFirestore(getApps()[0]);

export { adminDb }; 