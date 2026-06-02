'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ProgressBar from '@/components/ProgressBar';
import AudioPlayer from '@/components/AudioPlayer';
import ShareDialog from '@/components/ShareDialog';
import { generateId } from '@/lib/utils';

export default function LandingPage() {
  // App State Machine: 'idle' | 'uploaded' | 'generating' | 'ready'
  const [appState, setAppState] = useState<'idle' | 'uploaded' | 'generating' | 'ready'>('idle');

  // File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number } | null>(null);

  // Generation progress states
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('extracting');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Generated audio states
  const [generatedAudio, setGeneratedAudio] = useState<{
    audioUrl: string;
    title: string;
    shareId: string;
  } | null>(null);

  // Share Dialog state
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Global screen reader announcer
  const [srAlert, setSrAlert] = useState('');

  // File Handlers
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setAppState('uploaded');
    setGenerationError(null);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setDocumentId(null);
    setFileDetails(null);
    setGeneratedAudio(null);
    setAppState('idle');
    setSrAlert('');
  };

  // Upload and Generate Audio
  const handleGenerateAudio = async () => {
    if (!selectedFile) return;

    try {
      setAppState('generating');
      setProgress(5);
      setStage('extracting');
      setGenerationError(null);

      // Using guest auth token since auth is removed
      const idToken = 'guest-token-id';

      // Step 1: Upload
      setIsUploadingFile(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Failed to extract text');
      }

      const uploadData = await uploadRes.json();
      const docId = uploadData.documentId;
      setDocumentId(docId);
      setFileDetails({ name: selectedFile.name, size: selectedFile.size });
      setIsUploadingFile(false);

      // Step 2: Generate with SSE
      const jobId = generateId();
      setProgress(15);
      setStage('summarizing');

      const eventSource = new EventSource(`/api/progress?jobId=${jobId}&token=${idToken}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.stage) setStage(data.stage);
          if (data.percent) setProgress(data.percent);

          if (data.stage === 'complete' && data.audio) {
            eventSource.close();
            
            const audioData = {
              audioUrl: `/api/audio/${data.audio.id}`,
              title: data.audio.title,
              shareId: data.audio.shareId,
            };
            setGeneratedAudio(audioData);
            setAppState('ready');
            setSrAlert('Your audio generated successfully. You can now play or download it.');
          } else if (data.stage === 'error') {
            eventSource.close();
            if (data.message) setGenerationError(data.message);
            else if (data.error) setGenerationError(data.error);
          }
        } catch (e) {
          console.error(e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        eventSource.close();
      };

      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ documentId: docId, jobId }),
      });

      if (!generateRes.ok) {
        eventSource.close();
        const errData = await generateRes.json();
        throw new Error(errData.error || 'Failed to start generation');
      }

      // Handle successful generation fallback
      // In local dev with mock DB, SSE might not trigger across Next.js workers.
      // So we use the direct response from the generation API.
      const finalData = await generateRes.json();
      if (finalData && finalData.id) {
        eventSource.close();
        setGeneratedAudio({
          audioUrl: `/api/audio/${finalData.id}`,
          title: finalData.title,
          shareId: finalData.shareId,
        });
        setAppState('ready');
        setSrAlert('Your audio generated successfully. You can now play or download it.');
      }

    } catch (error) {
      console.error(error);
      setIsUploadingFile(false);
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
      setAppState('uploaded');
    }
  };

  const getShareUrl = () => {
    if (!generatedAudio) return '';
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/share/${generatedAudio.shareId}`;
  };

  return (
    <div className="min-h-screen bg-[#0f0a1e] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl" />

      <main className="flex-1 w-full max-w-3xl mx-auto space-y-10 z-10">
        
        {/* Branding & Headers */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 shadow-2xl mb-2 backdrop-blur-md">
            <span className="text-5xl">🎙️</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white Outfit leading-tight">
            Easy Audio Generator
          </h1>
          <div className="flex flex-col items-center justify-center space-y-1">
            <p className="text-lg text-purple-200 font-medium tracking-wide">
              An <span className="text-white font-bold">Accessible Life Interface</span> Platform
            </p>
            <p className="text-sm text-white/50 uppercase tracking-widest font-semibold">
              Developed by Ali Athar
            </p>
          </div>
          <p className="text-base text-white/70 max-w-2xl mx-auto leading-relaxed pt-2">
            Transform any document into a studio-quality, dual-speaker Urdu podcast. Experience the future of accessible content creation.
          </p>
        </div>

        {/* Main generation panel */}
        <div className="min-h-[220px] flex flex-col items-center justify-center w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          
          {appState === 'idle' && (
            <div className="w-full">
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={null}
                onRemove={handleRemoveFile}
              />
            </div>
          )}

          {appState === 'uploaded' && (
            <div className="w-full space-y-6 flex flex-col items-center">
              <div className="w-full text-center p-6 border border-purple-500/30 bg-purple-500/10 rounded-2xl">
                <p className="text-white font-semibold">Document Selected:</p>
                <p className="text-purple-300 truncate mt-1">{selectedFile?.name}</p>
              </div>
              
              <button
                onClick={handleGenerateAudio}
                disabled={isUploadingFile}
                className="w-full max-w-md py-4 px-8 rounded-2xl font-bold text-white tracking-wide shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
              >
                Generate Audio
              </button>
            </div>
          )}

          {appState === 'generating' && (
            <div className="w-full max-w-md mx-auto">
              <ProgressBar
                progress={progress}
                stage={stage}
                userName="Guest"
              />
            </div>
          )}

          {appState === 'ready' && generatedAudio && (
            <div className="w-full space-y-8 animate-fade-in flex flex-col items-center">
              <div className="w-full">
                <AudioPlayer
                  audioUrl={generatedAudio.audioUrl}
                  title={generatedAudio.title}
                  onShare={() => setIsShareOpen(true)}
                />
              </div>

              <button
                onClick={handleRemoveFile}
                className="w-full max-w-md py-4 px-8 rounded-2xl font-bold text-white tracking-wide shadow-lg border border-white/20 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Generate New
              </button>
            </div>
          )}

          {generationError && (
            <div className="mt-6 w-full p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm text-center">
              <span className="font-bold">Error:</span> {generationError}
            </div>
          )}
        </div>

      </main>

      {generatedAudio && (
        <ShareDialog
          shareUrl={getShareUrl()}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}

      {/* Global ARIA-Live Announcer for robust screen reader support */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {srAlert}
      </div>
    </div>
  );
}
