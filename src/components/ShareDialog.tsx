'use client';

import React, { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

interface ShareDialogProps {
  shareUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShareDialog({ shareUrl, isOpen, onClose }: ShareDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Check if Web Share API is supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      setCanShare(true);
    }
  }, []);

  // Listen for Escape key to close the dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Focus the copy button when opened
      setTimeout(() => copyButtonRef.current?.focus(), 100);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleWebShare = async () => {
    try {
      await navigator.share({
        title: 'Easy Audio Generator',
        text: 'Listen to this Urdu Audio Overview generated from a document!',
        url: shareUrl,
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Web share failed:', err);
      }
    }
  };

  // Close when clicking outside the dialog card
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-zinc-900/90 backdrop-blur-xl shadow-2xl space-y-6 relative animate-[scaleUp_0.2s_ease-out]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Close dialog"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="space-y-1">
          <h3 id="share-dialog-title" className="text-lg font-bold text-white Outfit">
            Share Audio Overview
          </h3>
          <p className="text-sm text-white/50">
            Anyone with this link can listen to this audio overview without logging in.
          </p>
        </div>

        {/* Link Input and Copy Button */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white/90 focus:outline-none focus:border-purple-500 font-mono select-all"
              aria-label="Shareable link"
            />
            <button
              ref={copyButtonRef}
              onClick={handleCopy}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center gap-1.5 min-w-[110px] justify-center ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied!
                </>
              ) : (
                'Copy Link'
              )}
            </button>
          </div>

          {/* Web Share API for Mobile */}
          {canShare && (
            <button
              onClick={handleWebShare}
              className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              Share via System
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
