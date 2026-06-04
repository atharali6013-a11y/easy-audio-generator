'use client';

import React, { useState, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import ProgressBar from '@/components/ProgressBar';
import AudioPlayer from '@/components/AudioPlayer';
import ShareDialog from '@/components/ShareDialog';
import { generateId } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const { user, loading, signIn, signOut } = useAuth();

  // Mock authentication states for local / developer fallback
  const [showMockForm, setShowMockForm] = useState(false);
  const [mockEmail, setMockEmail] = useState('');
  const [mockLoading, setMockLoading] = useState(false);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'guest-ali-athar',
          stage: 'unhandled_client_error',
          message: event.message || 'Unhandled Client Error',
          stack: event.error ? event.error.stack : undefined,
          context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
          }
        })
      }).catch(err => console.error('Failed to send unhandled error log:', err));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'guest-ali-athar',
          stage: 'unhandled_rejection',
          message: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
          context: {
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
          }
        })
      }).catch(err => console.error('Failed to send unhandled rejection log:', err));
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Track user traffic (page view session)
    if (user) {
      user.getIdToken().then(idToken => {
        fetch('/api/logs', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            userId: user.uid,
            stage: 'user_session',
            message: `User session active: ${user.email} (${user.displayName || 'No Name'})`,
            context: {
              email: user.email,
              name: user.displayName,
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
            }
          })
        }).catch(err => console.error('Failed to send active session log:', err));
      }).catch(console.error);
    }

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user]);

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

      // Dynamically retrieve authenticated user's ID token
      const idToken = user ? await user.getIdToken() : 'guest-token-id';

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
          if (data.stage) {
            setStage(data.stage);
            const stageLabels: Record<string, string> = {
              extracting: 'Reading your document...',
              summarizing: 'Creating Urdu conversation script using AI...',
              generating_audio: 'Recording audio voices...',
              uploading: 'Almost done, merging audio files...',
            };
            if (stageLabels[data.stage]) {
              setSrAlert(stageLabels[data.stage]);
            }
          }
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
            setSrAlert('Your audio generated successfully. Note: Audios are stored on our servers for 24 hours only. Please download your audio to keep it permanently.');
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

      // 1. Get the generated dialogue script
      const { script } = await generateRes.json();
      const totalTurns = script.turns.length;

      // 2. Synthesize turns with controlled concurrency (max 2 at a time)
      //    This prevents Microsoft Edge TTS rate-limiting and connection resets.
      setProgress(45);
      setStage('generating_audio');
      
      const MAX_CONCURRENT = 2;
      let completedTurns = 0;
      const turnUrls: string[] = new Array(totalTurns);
      let nextIdx = 0;

      async function processTurnWorker() {
        while (nextIdx < totalTurns) {
          const index = nextIdx++;
          const turn = script.turns[index];
          const turnRes = await fetch('/api/generate-turn', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              jobId,
              turnIndex: index,
              speaker: turn.speaker,
              text: turn.text,
            }),
          });
          if (!turnRes.ok) {
            const errData = await turnRes.json();
            throw new Error(errData.error || `Failed to generate audio for turn ${index + 1}`);
          }
          const { url } = await turnRes.json();
          turnUrls[index] = url;
          
          completedTurns++;
          const percent = Math.round(45 + (completedTurns / totalTurns) * 40);
          setProgress(percent);
        }
      }

      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT, totalTurns) },
        () => processTurnWorker()
      );
      await Promise.all(workers);

      // 3. Finalize and merge all turns into a single MP3
      setProgress(85);
      setStage('uploading');

      const finalizeRes = await fetch('/api/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          jobId,
          documentId: docId,
          title: script.title,
          turnUrls,
          turnSpeakers: script.turns.map((t: any) => t.speaker),
        }),
      });

      if (!finalizeRes.ok) {
        eventSource.close();
        const errData = await finalizeRes.json();
        throw new Error(errData.error || 'Failed to finalize audio');
      }

      const finalAudio = await finalizeRes.json();

      // Close EventSource and set the app to ready state
      eventSource.close();
      setGeneratedAudio({
        audioUrl: `/api/audio/${finalAudio.id}`,
        title: finalAudio.title,
        shareId: finalAudio.shareId,
      });
      setAppState('ready');
      setSrAlert('Your audio generated successfully. Note: Audios are stored on our servers for 24 hours only. Please download your audio to keep it permanently.');

    } catch (error) {
      console.error(error);
      setIsUploadingFile(false);
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
      setAppState('uploaded');

      // Log client-side error to database
      const idToken = user ? await user.getIdToken().catch(() => 'guest-token-id') : 'guest-token-id';
      fetch('/api/logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: user?.uid || 'guest-ali-athar',
          stage: stage,
          message: error instanceof Error ? error.message : 'Client-side generation failed',
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            documentId: documentId,
            fileName: fileDetails?.name,
            fileSize: fileDetails?.size,
            selectedFileName: selectedFile?.name,
            selectedFileSize: selectedFile?.size,
            progress: progress,
            url: typeof window !== 'undefined' ? window.location.href : ''
          }
        })
      }).catch(err => console.error('Failed to send error report:', err));
    }
  };

  const getShareUrl = () => {
    if (!generatedAudio) return '';
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/share/${generatedAudio.shareId}`;
  };

  const handleMockLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockEmail) return;
    setMockLoading(true);

    const guestUser = {
      uid: `mock-uid-${mockEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      displayName: mockEmail.split('@')[0],
      email: mockEmail,
      photoURL: null,
      getIdToken: async () => `mock-google-token-${mockEmail}`
    };

    setTimeout(() => {
      localStorage.setItem('guestUser', JSON.stringify(guestUser));
      window.location.reload(); // Refresh page to trigger app AuthProvider loading
    }, 400);
  };

  // Render Spinner if loading session state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] flex flex-col items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
        <p className="mt-4 text-purple-200 text-sm font-medium tracking-wide">Securing session...</p>
      </div>
    );
  }

  // Render Sign-In Page if user is logged out
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md space-y-8 z-10 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 shadow-2xl mb-2 backdrop-blur-md">
              <span className="text-5xl">🎙️</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white Outfit">
              Easy Audio Generator
            </h1>
            <p className="text-base text-purple-200/70 leading-relaxed max-w-sm mx-auto">
              Please sign in to transform your documents into interactive Urdu audio overview podcasts.
            </p>
          </div>

          <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
            {/* Google Sign-in button */}
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-bold text-white tracking-wide border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 active:scale-[0.98] transition-all shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </button>

            {/* Developer Mode section */}
            <div className="pt-4 border-t border-white/5 space-y-4">
              {!showMockForm ? (
                <button
                  onClick={() => setShowMockForm(true)}
                  className="text-xs text-purple-300/60 hover:text-purple-300 font-semibold underline transition-all"
                >
                  Developer Mode (Local Offline Test)
                </button>
              ) : (
                <form onSubmit={handleMockLoginSubmit} className="space-y-3 text-left">
                  <label htmlFor="mock-email" className="block text-xs font-semibold text-purple-200">
                    Developer Email:
                  </label>
                  <input
                    id="mock-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={mockEmail}
                    onChange={(e) => setMockEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-[#0c0717] text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowMockForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-white/60 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={mockLoading}
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white transition"
                    >
                      {mockLoading ? 'Logging in...' : 'Sign In Offline'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Authenticated Dashboard Generator
  return (
    <div className="min-h-screen bg-[#0f0a1e] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Dynamic Header with Logged-in User Profile */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-8 z-20 flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur-md">
        <div className="text-right">
          <p className="text-xs font-semibold text-white truncate max-w-[150px]">
            {user.displayName || user.email}
          </p>
          <p className="text-[9px] text-purple-300 font-mono tracking-wider uppercase font-semibold">Active User</p>
        </div>
        <button 
          onClick={signOut}
          className="text-xs font-bold text-red-400 hover:text-red-300 border-l border-white/10 pl-3 py-1 transition-colors"
        >
          Sign Out
        </button>
      </header>

      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <main className="flex-1 w-full max-w-3xl mx-auto space-y-10 z-10 pt-8">
        
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
                userName={user.displayName || 'Guest'}
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

              {/* 24-Hour Storage Warning Notice Card */}
              <div className="w-full p-5 rounded-2xl border border-purple-500/30 bg-purple-500/10 text-left flex gap-4 items-start shadow-xl backdrop-blur-md">
                <div className="text-2xl text-purple-300 select-none">
                  💡
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider Outfit">
                    Storage Notice
                  </h4>
                  <p className="text-sm text-purple-200 leading-relaxed">
                    This generated audio is stored on our servers for <span className="font-bold text-white">24 hours only</span>. Please download the audio file to your device to keep it permanently.
                  </p>
                </div>
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
