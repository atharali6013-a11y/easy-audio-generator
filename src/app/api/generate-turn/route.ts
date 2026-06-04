import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest, saveDebugLog } from '@/lib/db-client';
import { synthesizeSpeech } from '@/lib/tts';
import { uploadAudio } from '@/lib/storage';

export const maxDuration = 60; // Safe timeout for single turn

export async function POST(request: NextRequest) {
  let jobId = '';
  let turnIndex: number | undefined = undefined;
  let speaker = '';
  let text = '';
  let user: any = null;
  try {
    // 1. Authenticate user
    user = await verifyRequest(request);

    // 2. Parse request body
    const body = await request.json();
    const { jobId: reqJobId, turnIndex: reqTurnIndex, speaker: reqSpeaker, text: reqText } = body;
    jobId = reqJobId;
    turnIndex = reqTurnIndex;
    speaker = reqSpeaker;
    text = reqText;

    if (!jobId || turnIndex === undefined || !speaker || !text) {
      return NextResponse.json({ error: 'Missing required parameters: jobId, turnIndex, speaker, text' }, { status: 400 });
    }

    console.log(`[api/generate-turn] Synthesizing turn ${turnIndex} for job ${jobId} (speaker: ${speaker})`);

    // 3. Synthesize single turn using Edge TTS
    const audioBuffer = await synthesizeSpeech(text, (speaker === 'expert' ? 'expert' : 'host'));

    // 4. Upload single turn MP3 to storage
    const storageKey = `jobs/${jobId}/turn-${turnIndex}.mp3`;
    const downloadUrl = await uploadAudio(audioBuffer, storageKey);

    return NextResponse.json({ url: downloadUrl });
  } catch (error) {
    console.error('[api/generate-turn] Error synthesizing single turn:', error);
    const errorMsg = error instanceof Error ? error.message : 'Turn audio synthesis failed';
    
    await saveDebugLog({
      userId: user?.uid || 'guest',
      stage: 'generating_audio',
      message: `[api/generate-turn] ${errorMsg}`,
      stack: error instanceof Error ? error.stack : undefined,
      context: { jobId, turnIndex, speaker, textSnippet: text?.slice(0, 100) }
    }).catch(console.error);

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
