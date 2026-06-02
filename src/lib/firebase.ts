import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// ─── Firebase Configuration ─────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we should activate offline local mode fallback (when Firebase keys are missing/placeholder)
export const isLocalMode = 
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'your-api-key';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (!isLocalMode) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    storageInstance = getStorage(app);
  } catch (error) {
    console.error('[firebase] Failed to initialize Firebase client SDK:', error);
  }
}

// Export auth, db, storage (typed as their respective types, proxied for local mode support)
export const auth = new Proxy({} as Auth, {
  get(target, prop) {
    if (isLocalMode || !authInstance) {
      return null;
    }
    const val = Reflect.get(authInstance, prop);
    return typeof val === 'function' ? val.bind(authInstance) : val;
  }
});

export const db = new Proxy({} as Firestore, {
  get(target, prop) {
    if (isLocalMode || !dbInstance) {
      return null;
    }
    const val = Reflect.get(dbInstance, prop);
    return typeof val === 'function' ? val.bind(dbInstance) : val;
  }
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(target, prop) {
    if (isLocalMode || !storageInstance) {
      return null;
    }
    const val = Reflect.get(storageInstance, prop);
    return typeof val === 'function' ? val.bind(storageInstance) : val;
  }
});

export default app;
