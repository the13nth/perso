import * as admin from 'firebase-admin';

// Initialize Firebase Admin if it hasn't been initialized
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_STORAGE_BUCKET) {
      throw new Error('Missing Firebase configuration environment variables');
    }

    // Create service account from individual components
    const serviceAccount = {
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      projectId: process.env.FIREBASE_PROJECT_ID,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });

    // Get bucket reference
    const bucket = admin.storage().bucket();

    // Verify bucket exists and create if it doesn't
    bucket.exists().then(async ([exists]) => {
      if (exists) {
        console.log('Firebase Storage bucket initialized successfully:', process.env.FIREBASE_STORAGE_BUCKET);
      } else {
        console.warn('Firebase Storage bucket does not exist, attempting to create:', process.env.FIREBASE_STORAGE_BUCKET);
        try {
          await bucket.create();
          console.log('Firebase Storage bucket created successfully:', process.env.FIREBASE_STORAGE_BUCKET);
        } catch (error) {
          console.error('Error creating Firebase Storage bucket:', error);
        }
      }
    }).catch(error => {
      console.error('Error checking Firebase Storage bucket:', error);
    });

    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
}

// Export initialized services
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage().bucket();
export const storageBucket = admin.storage().bucket(); // Get bucket with explicit name 