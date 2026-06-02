'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

// ─── Header Component ───────────────────────────────────────────────────────

export default function Header() {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }, [signOut]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 glass-strong"
      role="banner"
    >
      <nav
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between">
          {/* ── Logo & App Name ─────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'var(--gradient-primary)' }}
              aria-hidden="true"
            >
              {/* Audio waveform icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-white"
              >
                <path d="M12 3v18" />
                <path d="M8 7v10" />
                <path d="M4 10v4" />
                <path d="M16 7v10" />
                <path d="M20 10v4" />
              </svg>
            </div>
            <span className="font-[family-name:var(--font-outfit)] text-lg font-bold tracking-tight text-white">
              Easy Audio Generator
            </span>
          </div>

          {/* ── Desktop User Section ───────────────────────────── */}
          {user && (
            <div className="hidden items-center gap-4 sm:flex">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={`${user.displayName ?? 'User'}'s avatar`}
                    className="h-8 w-8 rounded-full ring-2 ring-purple-500/30"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: 'var(--gradient-primary)' }}
                    aria-hidden="true"
                  >
                    {(user.displayName ?? 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-300">
                  {user.displayName ?? user.email ?? 'User'}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50"
                aria-label="Sign out of your account"
              >
                {signingOut ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                Sign Out
              </button>
            </div>
          )}

          {/* ── Mobile Hamburger Button ────────────────────────── */}
          {user && (
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* ── Mobile Menu ─────────────────────────────────────── */}
        {user && mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="border-t border-white/5 pb-4 pt-3 sm:hidden animate-fade-in"
            role="menu"
          >
            <div className="flex items-center gap-3 px-2 pb-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={`${user.displayName ?? 'User'}'s avatar`}
                  className="h-10 w-10 rounded-full ring-2 ring-purple-500/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white"
                  style={{ background: 'var(--gradient-primary)' }}
                  aria-hidden="true"
                >
                  {(user.displayName ?? 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {user.displayName ?? 'User'}
                </p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
              role="menuitem"
              aria-label="Sign out of your account"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
