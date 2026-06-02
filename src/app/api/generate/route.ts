import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyRequest, getDocument, saveJob, saveAudio } from '@/lib/db-client';
import { generateConversationScript } from '@/lib/llm';
import { generateFullAudio } from '@/lib/tts';
import { uploadAudio } from '@/lib/storage';

export const maxDuration = 300; // Max 5 minutes for generation pipeline

// Helper to update progress in DB
async function updateJob(jobId: string, data: { stage: string; percent: number; message: string; audio?: any; error?: string }) {
  await saveJob({
    id: jobId,
    ...data,
    updatedAt: new Date(),
  });
}

export async function POST(request: NextRequest) {
  let jobId = '';
  try {
    // 1. Authenticate user
    const user = await verifyRequest(request);

    // 2. Parse request body
    const body = await request.json();
    const { documentId, jobId: reqJobId } = body;
    jobId = reqJobId;

    if (!documentId || !jobId) {
      return NextResponse.json({ error: 'Missing documentId or jobId' }, { status: 400 });
    }

    console.log(`[api/generate] Starting generation for doc ${documentId}, job ${jobId}`);

    // Create initial job entry
    await updateJob(jobId, {
      stage: 'extracting',
      percent: 5,
      message: 'Initializing generation...',
    });

    // 3. Retrieve document and verify ownership
    const docData = await getDocument(documentId);
    if (!docData) {
      throw new Error('Document not found');
    }

    if (docData.userId !== user.uid) {
      return NextResponse.json({ error: 'Forbidden: Document ownership mismatch' }, { status: 403 });
    }

    const textContent = docData.textContent;
    const fileName = docData.fileName;

    // 4. Stage: Summarizing (10% - 40%)
    await updateJob(jobId, {
      stage: 'summarizing',
      percent: 15,
      message: 'Generating Urdu podcast dialogue script using AI...',
    });

    const script = await generateConversationScript(textContent);

    await updateJob(jobId, {
      stage: 'summarizing',
      percent: 40,
      message: 'Urdu script generated successfully.',
    });

    // 5. Stage: Generating Audio (40% - 85%)
    await updateJob(jobId, {
      stage: 'generating_audio',
      percent: 45,
      message: 'Synthesizing voice dialog overviews (Uzma & Asad voices)...',
    });

    const audioBuffer = await generateFullAudio(script, (percent) => {
      // Scale turn-by-turn progress from 45% to 85%
      const scaledPercent = Math.round(45 + (percent / 100) * 40);
      updateJob(jobId, {
        stage: 'generating_audio',
        percent: scaledPercent,
        message: `Synthesizing voices... (${percent}%)`,
      }).catch(err => console.error('Failed to update turn progress:', err));
    });

    // 6. Stage: Uploading (85% - 95%)
    await updateJob(jobId, {
      stage: 'uploading',
      percent: 90,
      message: 'Uploading final podcast audio to storage...',
    });

    const audioId = crypto.randomUUID();
    const shareId = crypto.randomBytes(6).toString('hex'); // Nice short unique share ID
    const storageKey = `audios/${audioId}.mp3`;

    const downloadUrl = await uploadAudio(audioBuffer, storageKey);

    // 7. Stage: Complete (100%)
    await updateJob(jobId, {
      stage: 'uploading',
      percent: 95,
      message: 'Finalizing database entries...',
    });

    const audioMeta = {
      id: audioId,
      shareId,
      userId: user.uid,
      fileName,
      downloadUrl,
      title: script.title,
      generatedAt: new Date(),
    };

    // Save metadata in DB
    await saveAudio(audioMeta);

    // Update job to complete
    await updateJob(jobId, {
      stage: 'complete',
      percent: 100,
      message: 'Audio Overview ready!',
      audio: audioMeta,
    });

    return NextResponse.json(audioMeta);
  } catch (error) {
    console.error(`[api/generate] Error in job ${jobId}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Audio generation failed';
    if (jobId) {
      await updateJob(jobId, {
        stage: 'error',
        percent: 0,
        message: errorMsg,
        error: errorMsg,
      }).catch(e => console.error('Failed to update job error state:', e));
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
