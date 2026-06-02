'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isLocalMode } from '@/lib/firebase';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Google Auth Provider ───────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Mock Guest User for Local/Offline Fallback Mode
const MOCK_GUEST_USER = {
  uid: 'guest-ali-athar',
  displayName: 'Mr. Ali Athar',
  email: 'ali.athar@guest.interface',
  photoURL: null,
  getIdToken: async () => 'guest-token-id',
} as any;

// ─── AuthProvider Component ─────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes (or load mock guest user in Local Mode)
  useEffect(() => {
    if (isLocalMode) {
      // Check if user was already logged in locally
      const storedUser = localStorage.getItem('guestUser');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          // Attach getIdToken async method to the deserialized mock user
          parsed.getIdToken = MOCK_GUEST_USER.getIdToken;
          setUser(parsed);
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await storeUserProfile(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google sign-in (or mock local login in Local Mode)
  const signIn = useCallback(async () => {
    setLoading(true);
    if (isLocalMode) {
      // Simulate rapid local guest login
      setTimeout(() => {
        setUser(MOCK_GUEST_USER);
        localStorage.setItem('guestUser', JSON.stringify(MOCK_GUEST_USER));
        setLoading(false);
      }, 500);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      console.error('Sign-in failed:', error);
      setLoading(false);
      throw error;
    }
  }, []);

  // Sign out (or clear guest session in Local Mode)
  const signOut = useCallback(async () => {
    if (isLocalMode) {
      setUser(null);
      localStorage.removeItem('guestUser');
      return;
    }

    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error: unknown) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── useAuth Hook ───────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ─── Firestore Helpers ────────────────--------------------------------------

async function storeUserProfile(user: User): Promise<void> {
  if (isLocalMode) return;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userDocRef,
        { lastLoginAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch (error) {
    console.warn('Failed to store user profile:', error);
  }
}
