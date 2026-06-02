'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

// ─── SignInButton Component ─────────────────────────────────────────────────

export default function SignInButton() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      // Don't show error for user-cancelled popups
      if (!message.includes('popup-closed-by-user')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [signIn]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className="group relative flex h-14 w-full max-w-sm items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-6 text-base font-semibold text-gray-800 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0a1e] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[280px]"
        aria-label="Sign in with Google"
      >
        {isLoading ? (
          <>
            {/* Loading Spinner */}
            <svg
              className="h-5 w-5 animate-spin text-purple-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Signing in...</span>
          </>
        ) : (
          <>
            {/* Google "G" Logo — Official Brand Colors */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 48 48"
              aria-hidden="true"
              className="flex-shrink-0"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.003 24.003 0 000 21.56l7.98-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>Sign in with Google</span>
          </>
        )}

        {/* Hover glow effect */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(135deg, rgba(147,51,234,0.05), rgba(99,102,241,0.05))',
          }}
          aria-hidden="true"
        />
      </button>

      {/* Error message */}
      {error && (
        <p className="animate-fade-in text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
