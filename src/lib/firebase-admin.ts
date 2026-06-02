// ============================================
// Easy Audio Generator — Firebase Admin SDK (Cloud + Local Fallback)
// ============================================
// Server-side Firebase initialization with auth token verification.
// FALLBACK: If credentials are not set, it acts as a fully-functional local database
// by persistence mapping collections to a local JSON file (db.json).

import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Local Persistence Setup (Mock Firestore)
// ---------------------------------------------------------------------------

const DB_FILE = path.join(process.cwd(), 'db.json');

// Memory store initialized from local JSON file
let localDbStore: Record<string, Record<string, any>> = {};
let snapshotListeners: Array<{ collection: string; docId: string; callback: (snap: any) => void }> = [];

function loadLocalDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      localDbStore = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('[mock-db] Failed to parse local JSON db:', e);
      localDbStore = {};
    }
  } else {
    localDbStore = {};
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDbStore, null, 2), 'utf-8');
  } catch (e) {
    console.error('[mock-db] Failed to write local JSON db:', e);
  }
}

// Ensure database file is loaded
loadLocalDb();

class MockDocRef {
  constructor(private collectionName: string, private docId: string) {}

  get id() {
    return this.docId;
  }

  async get() {
    loadLocalDb();
    const data = localDbStore[this.collectionName]?.[this.docId];
    return {
      exists: !!data,
      data: () => data || null,
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    loadLocalDb();
    if (!localDbStore[this.collectionName]) {
      localDbStore[this.collectionName] = {};
    }

    const existing = localDbStore[this.collectionName][this.docId] || {};
    const updated = options?.merge ? { ...existing, ...data } : data;
    
    localDbStore[this.collectionName][this.docId] = updated;
    saveLocalDb();

    // Trigger snapshot listeners
    const matchedListeners = snapshotListeners.filter(
      (l) => l.collection === this.collectionName && l.docId === this.docId
    );
    for (const listener of matchedListeners) {
      listener.callback({
        exists: true,
        data: () => updated,
      });
    }
  }

  onSnapshot(callback: (snapshot: any) => void, errorCallback?: (err: any) => void) {
    const listener = {
      collection: this.collectionName,
      docId: this.docId,
      callback,
    };
    snapshotListeners.push(listener);

    // Call initially with current state
    this.get().then((snap) => callback(snap));

    // Return unsubscribe function
    return () => {
      snapshotListeners = snapshotListeners.filter((l) => l !== listener);
    };
  }
}

class MockCollectionRef {
  constructor(private collectionName: string) {}

  doc(id?: string) {
    const docId = id || Math.random().toString(36).substring(2, 15);
    return new MockDocRef(this.collectionName, docId);
  }

  where(field: string, op: string, value: any) {
    return {
      limit: (n: number) => ({
        get: async () => {
          loadLocalDb();
          const docs: any[] = [];
          const colData = localDbStore[this.collectionName] || {};
          
          for (const [id, data] of Object.entries(colData)) {
            if (data && data[field] === value) {
              docs.push({
                id,
                data: () => data,
              });
            }
            if (docs.length >= n) break;
          }

          return {
            empty: docs.length === 0,
            docs,
          };
        },
      }),
      orderBy: (orderField: string, direction?: string) => ({
        onSnapshot: (callback: (snap: any) => void) => {
          // Simple mock callback returning match docs
          loadLocalDb();
          const docs: any[] = [];
          const colData = localDbStore[this.collectionName] || {};
          for (const [id, data] of Object.entries(colData)) {
            if (data && data[field] === value) {
              docs.push({
                id,
                data: () => data,
              });
            }
          }
          callback({ docs });
          return () => {};
        }
      })
    };
  }

  orderBy(field: string, direction?: string) {
    return {
      // Mock ordered query
      onSnapshot: (callback: (snap: any) => void) => {
        loadLocalDb();
        const docs: any[] = [];
        const colData = localDbStore[this.collectionName] || {};
        
        for (const [id, data] of Object.entries(colData)) {
          docs.push({
            id,
            data: () => data,
          });
        }
        
        // Simple sort
        docs.sort((a, b) => {
          const valA = a.data()[field];
          const valB = b.data()[field];
          if (valA instanceof Date && valB instanceof Date) {
            return direction === 'desc' ? valB.getTime() - valA.getTime() : valA.getTime() - valB.getTime();
          }
          return direction === 'desc' ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
        });

        callback({ docs });
        return () => {};
      }
    };
  }
}

const mockFirestore = {
  collection(name: string) {
    return new MockCollectionRef(name);
  },
};

// ---------------------------------------------------------------------------
// Initialization — guarded to prevent re-init in hot-reload / serverless
// ---------------------------------------------------------------------------

const FIREBASE_ADMIN_PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const FIREBASE_ADMIN_CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const FIREBASE_ADMIN_PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

// Check if we should activate offline local mode fallback for server functions
export const isAdminLocalMode = 
  !FIREBASE_ADMIN_PROJECT_ID || 
  FIREBASE_ADMIN_PROJECT_ID === 'your-project-id' ||
  !FIREBASE_ADMIN_CLIENT_EMAIL ||
  FIREBASE_ADMIN_CLIENT_EMAIL.startsWith('firebase-adminsdk-xxxxx');

let cachedAuth: ReturnType<typeof getAuth> | null = null;
let cachedDb: ReturnType<typeof getFirestore> | null = null;

function ensureInitialized() {
  if (isAdminLocalMode) return;
  if (cachedAuth && cachedDb) return;

  if (getApps().length > 0) {
    cachedAuth = getAuth();
    cachedDb = getFirestore();
    return;
  }

  try {
    const serviceAccount: ServiceAccount = {
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
      projectId: FIREBASE_ADMIN_PROJECT_ID,
    });

    cachedAuth = getAuth();
    cachedDb = getFirestore();
  } catch (error) {
    console.error('[firebase-admin] Lazy initialization failed:', error);
  }
}

// Export Proxied objects to support seamless transparent mocking
export const adminAuth = new Proxy({} as any, {
  get(target, prop) {
    if (isAdminLocalMode) {
      return null;
    }
    ensureInitialized();
    if (!cachedAuth) {
      throw new Error('Firebase Admin SDK is not initialized.');
    }
    const val = Reflect.get(cachedAuth, prop);
    return typeof val === 'function' ? val.bind(cachedAuth) : val;
  }
});

export const adminDb = new Proxy({} as any, {
  get(target, prop) {
    if (isAdminLocalMode) {
      // Direct call delegation to Mock Firestore database
      return Reflect.get(mockFirestore, prop);
    }
    ensureInitialized();
    if (!cachedDb) {
      throw new Error('Firebase Firestore Admin SDK is not initialized.');
    }
    const val = Reflect.get(cachedDb, prop);
    return typeof val === 'function' ? val.bind(cachedDb) : val;
  }
});

// ---------------------------------------------------------------------------
// Token verification helper (supports Guest tokens in Offline Mode)
// ---------------------------------------------------------------------------

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
}

export async function verifyToken(token: string): Promise<VerifiedUser> {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  // Support transparent local token verification
  if (isAdminLocalMode && token === 'guest-token-id') {
    return {
      uid: 'guest-ali-athar',
      name: 'Mr. Ali Athar',
      email: 'ali.athar@guest.interface',
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token, true);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    throw new Error(`Authentication failed: ${message}`);
  }
}

export async function verifyRequest(request: Request): Promise<VerifiedUser> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  const token = authHeader.slice(7);
  return verifyToken(token);
}
