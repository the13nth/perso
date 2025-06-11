import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';

function getServiceAccount() {
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  });

  try {
    // First try loading from our new config file
    const serviceAccount = require('../../config/secure/firebase-service-account');
    console.log('Successfully loaded service account from config file');
    return serviceAccount;
  } catch (error) {
    console.log('Failed to load from config file, falling back to environment variable');
    
    // Fall back to environment variable if config file not found
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
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
  }
  
  console.error('All attempts to load Firebase service account failed');
  throw new Error('No Firebase service account credentials found. Please provide either a config file or set FIREBASE_SERVICE_ACCOUNT environment variable.');
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