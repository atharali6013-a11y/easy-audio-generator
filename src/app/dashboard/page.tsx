'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';
import ProgressBar from '@/components/ProgressBar';
import AudioPlayer from '@/components/AudioPlayer';
import ShareDialog from '@/components/ShareDialog';
import { generateId } from '@/lib/utils';
import { db, isLocalMode } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';

// ─── Dashboard Component ───────────────────────────────────────────────────

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

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

  // Audio History state
  const [history, setHistory] = useState<DocumentData[]>([]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch history from Local Storage or Firestore
  useEffect(() => {
    if (!user) return;

    if (isLocalMode) {
      const loadLocalHistory = () => {
        const stored = localStorage.getItem('localAudios') || '[]';
        try {
          setHistory(JSON.parse(stored));
        } catch {
          setHistory([]);
        }
      };

      loadLocalHistory();
      window.addEventListener('localAudiosUpdated', loadLocalHistory);
      return () => window.removeEventListener('localAudiosUpdated', loadLocalHistory);
    }

    const q = query(
      collection(db, 'audios'),
      where('userId', '==', user.uid),
      orderBy('generatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHistory(items);
      },
      (err) => {
        console.error('Error fetching history:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // File Handlers
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setAppState('uploaded');
    setGenerationError(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setDocumentId(null);
    setFileDetails(null);
    setAppState('idle');
  }, []);

  // Upload and Generate Audio
  const handleGenerateAudio = async () => {
    if (!selectedFile || !user) return;

    try {
      setAppState('generating');
      setProgress(5);
      setStage('extracting');
      setGenerationError(null);

      const idToken = await user.getIdToken();

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
            
            // Map the audioUrl dynamically to the dynamic API route
            const audioData = {
              audioUrl: `/api/audio/${data.audio.id}`,
              title: data.audio.title,
              shareId: data.audio.shareId,
            };
            setGeneratedAudio(audioData);

            if (isLocalMode) {
              const stored = localStorage.getItem('localAudios') || '[]';
              try {
                const list = JSON.parse(stored);
                list.unshift({
                  id: data.audio.id,
                  title: data.audio.title,
                  fileName: selectedFile.name,
                  downloadUrl: `/api/audio/${data.audio.id}`,
                  shareId: data.audio.shareId,
                  generatedAt: { seconds: Date.now() / 1000 },
                });
                localStorage.setItem('localAudios', JSON.stringify(list));
                window.dispatchEvent(new Event('localAudiosUpdated'));
              } catch (e) {
                console.error(e);
              }
            }

            setAppState('ready');
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

    } catch (error) {
      console.error(error);
      setIsUploadingFile(false);
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
      setAppState('uploaded');
    }
  };

  const handleSelectHistoryItem = (item: DocumentData) => {
    setGeneratedAudio({
      audioUrl: `/api/audio/${item.id}`,
      title: item.title,
      shareId: item.shareId,
    });
    setAppState('ready');
  };

  const getShareUrl = () => {
    if (!generatedAudio) return '';
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${base}/share/${generatedAudio.shareId}`;
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0a1e]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
          <span className="text-sm font-medium text-purple-300">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0a1e] flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main generation panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white Outfit">
              Create Urdu Audio
            </h1>
            <p className="text-sm text-white/50">
              Upload any document to create a dual-speaker Urdu podcast dialogue summary.
            </p>
          </div>

          <div className="min-h-[220px] flex items-center justify-center">
            {appState === 'idle' && (
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onRemove={handleRemoveFile}
              />
            )}

            {appState === 'uploaded' && (
              <div className="w-full space-y-6">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onRemove={handleRemoveFile}
                />
                
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleGenerateAudio}
                    disabled={isUploadingFile}
                    className="w-full max-w-md py-4 px-8 rounded-2xl font-bold text-white tracking-wide shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                  >
                    Generate Urdu Audio Overview 🎙️
                  </button>
                </div>
              </div>
            )}

            {appState === 'generating' && (
              <ProgressBar
                progress={progress}
                stage={stage}
                userName={user.displayName}
              />
            )}

            {appState === 'ready' && generatedAudio && (
              <div className="w-full space-y-6 animate-fade-in">
                <AudioPlayer
                  audioUrl={generatedAudio.audioUrl}
                  title={generatedAudio.title}
                  onShare={() => setIsShareOpen(true)}
                />

                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      handleRemoveFile();
                      setAppState('idle');
                    }}
                    className="px-6 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Generate Another Audio
                  </button>
                </div>
              </div>
            )}
          </div>

          {generationError && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm text-center">
              <span className="font-bold">Error:</span> {generationError}
            </div>
          )}
        </div>

        {/* History sidebar */}
        <div className="space-y-4 lg:border-l lg:border-white/5 lg:pl-8">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-white Outfit">Audio History</h2>
            <p className="text-xs text-white/40">Previously generated audio overviews</p>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <div className="p-8 text-center border border-white/5 bg-white/[0.02] rounded-2xl text-xs text-white/30">
                No files found.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectHistoryItem(item)}
                  className="p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30 cursor-pointer transition-all duration-200 group text-left"
                >
                  <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 truncate Outfit">
                    {item.title}
                  </h3>
                  <div className="flex justify-between items-center mt-1.5 text-[10px] text-white/40">
                    <span className="truncate max-w-[150px]">{item.fileName}</span>
                    <span>
                      {item.generatedAt?.seconds 
                        ? new Date(item.generatedAt.seconds * 1000).toLocaleDateString()
                        : new Date().toLocaleDateString()
                      }
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {generatedAudio && (
        <ShareDialog
          shareUrl={getShareUrl()}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
}
