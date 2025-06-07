import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import path from 'path';

// Initialize Firebase Admin if it hasn't been initialized
const apps = getApps();

// Read and parse the service account JSON file
const serviceAccountPath = path.join(process.cwd(), 'lib/firebase/credentials/service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

const adminApp = apps.length === 0 
  ? initializeApp({
      credential: cert(serviceAccount),
    })
  : apps[0];

// Initialize Firestore
const adminDb = getFirestore(adminApp);

export { adminDb }; 