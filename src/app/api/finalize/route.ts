import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { verifyRequest, saveJob, saveAudio, getDocument, saveDebugLog } from '@/lib/db-client';
import { uploadAudio } from '@/lib/storage';

export const maxDuration = 120; // Safe timeout for finalization

// Silent MP3 frame chunk (~0.3 seconds)
const SILENT_MP3_B64 = 
  '//NkxHwAAANIAAAAAKqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NkxHwAAANIAAAAAKqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NkxHwAAANIAAAAAKqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NkxHwAAANIAAAAAKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';


function getSilenceBuffer(ms: number): Buffer {
  const numChunks = Math.max(1, Math.round(ms / 300));
  const chunks: Buffer[] = [];
  const baseChunk = Buffer.from(SILENT_MP3_B64, 'base64');
  const cleanBase = stripId3AndXing(baseChunk);
  for (let i = 0; i < numChunks; i++) {
    chunks.push(cleanBase);
  }
  return Buffer.concat(chunks);
}

async function getBufferFromUrl(url: string): Promise<Buffer> {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch turn audio from ${url}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    // Local relative URL fallback
    const cleanPath = url.startsWith('/') ? url.slice(1) : url;
    const fullPath = path.join(process.cwd(), 'public', cleanPath);
    return fs.promises.readFile(fullPath);
  }
}

export async function POST(request: NextRequest) {
  let jobId = '';
  let documentId = '';
  let turnUrls: any[] = [];
  let user: any = null;
  try {
    // 1. Authenticate user
    user = await verifyRequest(request);

    // 2. Parse request body
    const body = await request.json();
    const { jobId: reqJobId, documentId: reqDocId, title, turnUrls: reqTurnUrls, turnSpeakers } = body;
    jobId = reqJobId;
    documentId = reqDocId;
    turnUrls = reqTurnUrls;

    if (!jobId || !documentId || !title || !turnUrls || !turnSpeakers || turnUrls.length !== turnSpeakers.length) {
      return NextResponse.json({ error: 'Missing or mismatched required parameters' }, { status: 400 });
    }

    console.log(`[api/finalize] Merging ${turnUrls.length} turns for job ${jobId}`);

    // Update job to uploading progress
    await saveJob({
      id: jobId,
      stage: 'uploading',
      percent: 85,
      message: 'Downloading and concatenating audio turns...',
      updatedAt: new Date()
    });

    // 3. Download all turn audio buffers
    const turnBuffers = await Promise.all(turnUrls.map((url: string) => getBufferFromUrl(url)));

    // 4. Interleave turn buffers with natural silent gaps (no FFmpeg needed)
    const finalChunks: Buffer[] = [];
    for (let i = 0; i < turnBuffers.length; i++) {
      finalChunks.push(stripId3AndXing(turnBuffers[i]));

      // Add silence between turns
      if (i < turnBuffers.length - 1) {
        const currentSpeaker = turnSpeakers[i];
        const nextSpeaker = turnSpeakers[i + 1];
        const silenceDuration = currentSpeaker === nextSpeaker ? 500 : 800;
        finalChunks.push(stripId3AndXing(getSilenceBuffer(silenceDuration)));
      }
    }

    const mergedBuffer = Buffer.concat(finalChunks);

    await saveJob({
      id: jobId,
      stage: 'uploading',
      percent: 90,
      message: 'Uploading merged podcast to cloud storage...',
      updatedAt: new Date()
    });

    // 5. Upload final merged MP3 to storage
    const audioId = crypto.randomUUID();
    const shareId = crypto.randomBytes(6).toString('hex');
    const storageKey = `audios/${audioId}.mp3`;

    const downloadUrl = await uploadAudio(mergedBuffer, storageKey);

    // 6. Retrieve document and save final audio metadata
    const docData = await getDocument(documentId);
    const fileName = docData ? docData.fileName : 'podcast.pdf';

    const audioMeta = {
      id: audioId,
      shareId,
      userId: user.uid,
      fileName,
      downloadUrl,
      title,
      generatedAt: new Date(),
    };

    await saveAudio(audioMeta);

    // 7. Update job state to complete
    await saveJob({
      id: jobId,
      stage: 'complete',
      percent: 100,
      message: 'Audio Overview ready!',
      audio: audioMeta,
      updatedAt: new Date()
    });

    console.log(`[api/finalize] Job ${jobId} finalized successfully. URL: ${downloadUrl}`);
    return NextResponse.json(audioMeta);
  } catch (error) {
    console.error(`[api/finalize] Error finalizing job ${jobId}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Finalization failed';
    
    await saveDebugLog({
      userId: user?.uid || 'guest',
      stage: 'uploading',
      message: `[api/finalize] ${errorMsg}`,
      stack: error instanceof Error ? error.stack : undefined,
      context: { jobId, documentId, turnUrlsCount: turnUrls?.length }
    }).catch(console.error);

    if (jobId) {
      await saveJob({
        id: jobId,
        stage: 'error',
        percent: 0,
        message: errorMsg,
        error: errorMsg,
        updatedAt: new Date()
      }).catch(e => console.error('Failed to update job error state:', e));
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Pure JS MP3 Header/Metadata Frame Stripper
// ---------------------------------------------------------------------------

function getFrameSize(buf: Buffer): number {
  if (buf.length < 4) return 0;
  if (buf[0] !== 0xFF || (buf[1] & 0xE0) !== 0xE0) return 0;
  
  const versionIdx = (buf[1] >> 3) & 3; // 3 = V1, 2 = V2, 0 = V2.5
  const layerIdx = (buf[1] >> 1) & 3;   // 3 = L1, 2 = L2, 1 = L3
  const bitrateIdx = (buf[2] >> 4) & 0x0F;
  const samplerateIdx = (buf[2] >> 2) & 3;
  const padding = (buf[2] >> 1) & 1;
  
  if (versionIdx === 1 || layerIdx === 0 || bitrateIdx === 15 || samplerateIdx === 3) {
    return 0;
  }
  
  // Bitrate tables in kbps
  const v1Bitrates = {
    3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0], // L1
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],    // L2
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],    // L3
  };
  
  const v2Bitrates = {
    3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],    // L1
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],        // L2/L3
    1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],        // L2/L3
  };
  
  const bitrateTable = versionIdx === 3 ? v1Bitrates : v2Bitrates;
  // @ts-ignore
  const bitrate = (bitrateTable[layerIdx]?.[bitrateIdx] || 0) * 1000;
  
  const v1Samplerates = [44100, 48000, 32000, 0];
  const v2Samplerates = [22050, 24000, 16000, 0];
  const v25Samplerates = [11025, 12000, 8000, 0];
  
  let samplerate = 0;
  if (versionIdx === 3) samplerate = v1Samplerates[samplerateIdx];
  else if (versionIdx === 2) samplerate = v2Samplerates[samplerateIdx];
  else if (versionIdx === 0) samplerate = v25Samplerates[samplerateIdx];
  
  if (!bitrate || !samplerate) return 0;
  
  if (layerIdx === 3) {
    // Layer I
    return Math.floor((12 * bitrate) / samplerate + padding) * 4;
  } else if (layerIdx === 2) {
    // Layer II
    return Math.floor(144 * bitrate / samplerate) + padding;
  } else {
    // Layer III
    if (versionIdx === 3) {
      return Math.floor(144 * bitrate / samplerate) + padding;
    } else {
      return Math.floor(72 * bitrate / samplerate) + padding;
    }
  }
}

function stripId3AndXing(buffer: Buffer): Buffer {
  let offset = 0;
  
  // 1. Strip ID3v2 tag
  if (buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const version = buffer[3];
    let size = 0;
    
    if (version === 2) {
      // ID3v2.2 size is 3 bytes (bytes 6, 7, 8) as standard 24-bit integer
      size = (buffer[6] << 16) | (buffer[7] << 8) | buffer[8];
    } else {
      // ID3v2.3/4 size is 4 bytes (bytes 6, 7, 8, 9)
      const isSynchsafe = ((buffer[6] | buffer[7] | buffer[8] | buffer[9]) & 0x80) === 0;
      if (isSynchsafe) {
        size = ((buffer[6] & 0x7F) << 21) | ((buffer[7] & 0x7F) << 14) | ((buffer[8] & 0x7F) << 7) | (buffer[9] & 0x7F);
      } else {
        // Non-synchsafe standard 32-bit big-endian integer
        size = (buffer[6] << 24) | (buffer[7] << 16) | (buffer[8] << 8) | buffer[9];
      }
    }
    
    offset = 10 + size;
    // Account for footer (10 bytes) if present in ID3v2.4
    if (version === 4 && (buffer[5] & 0x10) !== 0) {
      offset += 10;
    }
    
    if (offset > buffer.length) {
      offset = buffer.length;
    }
  }
  
  let audioBuffer = buffer.slice(offset);
  
  // Find actual start of MP3 frame sync word to bypass any padding/junk bytes
  let syncOffset = -1;
  for (let i = 0; i < audioBuffer.length - 1; i++) {
    if (audioBuffer[i] === 0xFF && (audioBuffer[i + 1] & 0xE0) === 0xE0) {
      syncOffset = i;
      break;
    }
  }
  
  if (syncOffset >= 0) {
    audioBuffer = audioBuffer.slice(syncOffset);
  }
  
  // 2. Strip Xing/Info/LAME frame if present at start of stream
  if (audioBuffer.length > 4) {
    const firstFrame = audioBuffer.slice(0, Math.min(200, audioBuffer.length));
    const firstFrameStr = firstFrame.toString('binary');
    if (firstFrameStr.includes('Xing') || firstFrameStr.includes('Info') || firstFrameStr.includes('LAME')) {
      const frameSize = getFrameSize(audioBuffer);
      if (frameSize > 0 && frameSize <= audioBuffer.length) {
        audioBuffer = audioBuffer.slice(frameSize);
      }
    }
  }
  
  return audioBuffer;
}

