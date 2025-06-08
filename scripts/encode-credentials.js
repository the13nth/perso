import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the service account file
const serviceAccountPath = join(__dirname, '../lib/firebase/credentials/service-account.json');
const serviceAccount = readFileSync(serviceAccountPath, 'utf8');

// Convert to base64
const base64 = Buffer.from(serviceAccount).toString('base64');

console.log('Add this value to your Netlify environment variables as FIREBASE_SERVICE_ACCOUNT:');
console.log(base64); 