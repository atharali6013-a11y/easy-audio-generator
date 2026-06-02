'use client';

import React, { useEffect, useState } from 'react';
import AudioPlayer from '@/components/AudioPlayer';
import ShareDialog from '@/components/ShareDialog';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AudioMetadata {
  title: string;
  downloadUrl: string;
  duration?: number;
  createdAt?: string;
  fileName?: string;
}

// ─── Public Share Page ───────────────────────────────────────────────────────

export default function SharePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [audioData, setAudioData] = useState<AudioMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`/api/share/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('The requested audio overview does not exist or has been deleted.');
          }
          throw new Error('Failed to retrieve audio overview metadata.');
        }

        const data = await res.json();
        setAudioData(data);
      } catch (err) {
        console.error('Error fetching share metadata:', err);
        setError(err instanceof Error ? err.message : 'An error occurred.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchMetadata();
    }
  }, [id]);

  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0a1e]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
          <span className="text-sm font-medium text-purple-300">Retrieving Audio Overview...</span>
        </div>
      </div>
    );
  }

  if (error || !audioData) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0a1e] px-6">
        <div className="w-full max-w-md p-8 rounded-2xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-bold text-white Outfit">Failed to load audio</h2>
          <p className="text-sm text-red-400">{error || 'Invalid audio link'}</p>
          <a
            href="/"
            className="inline-block mt-4 px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-sm hover:from-purple-600 hover:to-indigo-600 transition-all"
          >
            Go to Easy Audio Generator
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0a1e] flex flex-col justify-between py-12 px-6">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl" />

      {/* Main content container */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full space-y-10 z-10">
        
        {/* Header branding */}
        <div className="text-center space-y-2">
          <a href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🎙️</span>
            <span className="font-[family-name:var(--font-outfit)] text-lg font-bold text-white tracking-wide">
              Easy Audio Generator
            </span>
          </a>
          <p className="text-xs text-white/40">Urdu Conversational Podcast Overview</p>
        </div>

        {/* Audio Player Card */}
        <div className="w-full">
          <AudioPlayer
            audioUrl={audioData.downloadUrl}
            title={audioData.title}
            onShare={() => setIsShareOpen(true)}
          />
        </div>

        {/* Call to action for public visitors */}
        <div className="text-center space-y-3">
          <p className="text-sm text-white/50">Want to generate Urdu audio overviews from your own documents?</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white text-sm font-semibold transition-all active:scale-95 shadow-xl backdrop-blur-md"
          >
            Create Your Own Audio Overview 🚀
          </a>
        </div>
      </div>

      {/* Footer credits */}
      <footer className="text-center text-xs text-white/40 z-10 pt-8">
        <p>Powered by Easy Audio Generator</p>
        <p className="mt-1 text-[10px] text-white/30">Developed by Mr. Ali Athar, Accessible Life Interface.</p>
      </footer>

      {/* Share Dialog */}
      <ShareDialog
        shareUrl={getShareUrl()}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}
