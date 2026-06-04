import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest, getDocument, saveJob, saveDebugLog } from '@/lib/db-client';
import { generateConversationScript } from '@/lib/llm';

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
  let documentId = '';
  let user: any = null;
  try {
    // 1. Authenticate user
    user = await verifyRequest(request);

    // 2. Parse request body
    const body = await request.json();
    const { documentId: reqDocId, jobId: reqJobId } = body;
    jobId = reqJobId;
    documentId = reqDocId;

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

    // Update job to script_ready and save the script in the audio JSONB field
    await updateJob(jobId, {
      stage: 'script_ready',
      percent: 40,
      message: 'Urdu script generated successfully.',
      audio: { script }
    });

    return NextResponse.json({ script });
  } catch (error) {
    console.error(`[api/generate] Error in job ${jobId}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Audio generation failed';
    
    await saveDebugLog({
      userId: user?.uid || 'guest',
      stage: 'summarizing',
      message: `[api/generate] ${errorMsg}`,
      stack: error instanceof Error ? error.stack : undefined,
      context: { jobId, documentId }
    }).catch(console.error);

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
