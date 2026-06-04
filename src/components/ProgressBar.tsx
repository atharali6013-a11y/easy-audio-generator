'use client';

import React from 'react';
import { getFirstName } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  progress: number;
  stage: string;
  userName?: string | null;
}

// ---------------------------------------------------------------------------
// Stage Config
// ---------------------------------------------------------------------------

const STAGE_CONFIG: Record<string, { label: string; icon: string }> = {
  extracting: {
    label: 'Reading your document... 📄',
    icon: '📄',
  },
  summarizing: {
    label: 'Creating Urdu conversation... 🗣️',
    icon: '🗣️',
  },
  generating_audio: {
    label: 'Recording audio... 🎙️',
    icon: '🎙️',
  },
  uploading: {
    label: 'Almost done... ☁️',
    icon: '☁️',
  },
  complete: {
    label: 'Your audio is ready! 🎉',
    icon: '🎉',
  },
  error: {
    label: 'An error occurred. Please try again.',
    icon: '❌',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProgressBar({ progress, stage, userName }: ProgressBarProps) {
  const isEarlyStage = stage === 'extracting' || stage === 'summarizing';
  const isError = stage === 'error';

  const currentStage = STAGE_CONFIG[stage] || {
    label: 'Processing your document...',
    icon: '⚙️',
  };

  const name = getFirstName(userName) || 'Guest';

  return (
    <div className="w-full relative">
      {/* Accessible Container with semantic headings */}
      <div 
        className="w-full max-w-2xl mx-auto p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl text-center space-y-6"
      >
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-white/90 Outfit">
            Dear {name},
          </h2>
          
          {isError ? (
            <h2 className="text-lg text-red-400 font-medium tracking-wide flex justify-center items-center gap-2 font-semibold">
              <span className="text-2xl">{currentStage.icon}</span>
              {currentStage.label}
            </h2>
          ) : (
            <h2 className="text-lg text-purple-300 font-medium tracking-wide font-normal">
              Please hold on while we generate your audio. This process involves deep cloud AI processing and may take 2 to 3 minutes. 😊
            </h2>
          )}
          
          {isEarlyStage && (
            <div className="flex justify-center mt-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
            </div>
          )}
        </div>

        {!isEarlyStage && !isError && (
          <div className="flex justify-center items-center text-sm font-semibold px-1 py-4">
            <span className="text-white/80 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <span className="text-xl animate-bounce">{currentStage.icon}</span>
              <span className="text-base tracking-wide">{currentStage.label}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
