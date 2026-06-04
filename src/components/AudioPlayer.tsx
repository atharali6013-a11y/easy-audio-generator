'use client';

import React, { useRef, useState, useEffect } from 'react';
import { formatTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  onShare: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AudioPlayer({ audioUrl, title, onShare }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state on audioURL change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setIsLoading(true);
  }, [audioUrl]);

  // Event handlers for HTML5 Audio
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.error('Audio play failed', err));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setIsLoading(false);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekValue = parseFloat(e.target.value);
    audioRef.current.currentTime = seekValue;
    setCurrentTime(seekValue);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!audioRef.current) return;
    switch (e.key) {
      case ' ': // Space key plays/pauses
        e.preventDefault();
        handlePlayPause();
        break;
      case 'ArrowRight': // Fast forward 5s
        audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 5, duration);
        break;
      case 'ArrowLeft': // Rewind 5s
        audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 5, 0);
        break;
      default:
        break;
    }
  };

  const downloadAudio = () => {
    const a = document.createElement('a');
    // Append download=true query parameter to trigger forced download via backend
    const urlWithParam = audioUrl.includes('?') ? `${audioUrl}&download=true` : `${audioUrl}?download=true`;
    a.href = urlWithParam;
    a.download = `${title.replace(/\s+/g, '_') || 'audio_overview'}.mp3`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl space-y-6"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`Audio player for ${title}. Press Space to play/pause, arrows to seek.`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        preload="metadata"
      />

      <div className="text-center space-y-1">
        <h4 className="text-xs font-semibold tracking-wider text-purple-400 uppercase">Urdu Audio Overview</h4>
        <h3 className="text-xl font-bold tracking-tight text-white/90 truncate Outfit px-4">
          {title}
        </h3>
      </div>

      {/* Waveform Visualization */}
      <div className="flex justify-center items-center h-16 gap-[3px] px-8">
        {Array.from({ length: 24 }).map((_, i) => {
          // Generate a wave-like look, taller in the middle
          const baseHeight = 15 + Math.sin((i / 23) * Math.PI) * 35;
          return (
            <div
              key={i}
              className={`w-[6px] rounded-full transition-all duration-300 ${
                isPlaying
                  ? 'bg-gradient-to-t from-purple-500 to-indigo-500 animate-[pulseWave_1.2s_infinite]'
                  : 'bg-white/10'
              }`}
              style={{
                height: `${baseHeight}px`,
                animationDelay: isPlaying ? `${i * 0.05}s` : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Seek bar */}
      <div className="space-y-2">
        <div className="relative group">
          <input
            ref={progressBarRef}
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
            aria-label="Audio progress slider"
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 pointer-events-none"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-white/50 font-medium font-mono px-1">
          <span>{formatTime(currentTime)}</span>
          <span>{isLoading ? 'Loading...' : formatTime(duration)}</span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex justify-between items-center px-4">
        {/* Share Button */}
        <button
          onClick={onShare}
          className="p-3 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
          aria-label="Share audio overview"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={`relative p-5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg transition-all active:scale-95 hover:shadow-purple-500/20 hover:scale-105 ${
            isPlaying ? 'animate-[pulse_2s_infinite]' : ''
          }`}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isPlaying ? (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-8 h-8 translate-x-[2px]" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Download Button */}
        <button
          onClick={downloadAudio}
          className="p-3 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
          aria-label="Download audio overview"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
