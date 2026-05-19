import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdminApp() {
  if (firebaseApp) return firebaseApp;

  const relPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!relPath) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not set');

  const fullPath = join(process.cwd(), relPath);
  const raw = readFileSync(fullPath, 'utf8');
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return firebaseApp;
}

export async function verifyIdToken(idToken: string) {
  getFirebaseAdminApp();
  return admin.auth().verifyIdToken(idToken);
}
