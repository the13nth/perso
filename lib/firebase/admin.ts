import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    hasFirebaseConfig: !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    ),
  });

  // Use individual environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }
  
  console.error('Firebase configuration is missing');
  throw new Error('Missing required Firebase environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
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