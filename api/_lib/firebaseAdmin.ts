import * as admin from 'firebase-admin';

// Singleton — Vercel may reuse the same function instance across requests.
if (!admin.apps.length) {
  // Vercel env pull wraps JSON values in double quotes — strip them if present.
  let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT!;
  if (serviceAccount.startsWith('"') && serviceAccount.endsWith('"')) {
    serviceAccount = serviceAccount.slice(1, -1);
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
