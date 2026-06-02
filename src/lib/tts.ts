// ============================================
// Easy Audio Generator — TTS Integration (Microsoft Edge TTS + Mock Fallback)
// ============================================

import { EdgeTTS } from 'node-edge-tts';
import type { ConversationScript } from '@/types';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOICE_HOST = 'ur-PK-UzmaNeural'; // Female voice for Host
const VOICE_EXPERT = 'ur-PK-AsadNeural'; // Male voice for Expert

// A tiny silent MP3 buffer chunk (~0.3 seconds at 24khz 96kbps mono)
const SILENT_MP3_B64 = 
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQDkAAAAAAAAAGw9wrNaQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

function getSilenceBuffer(ms: number): Buffer {
  const numChunks = Math.max(1, Math.round(ms / 300));
  const chunks: Buffer[] = [];
  const baseChunk = Buffer.from(SILENT_MP3_B64, 'base64');
  for (let i = 0; i < numChunks; i++) {
    chunks.push(baseChunk);
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function synthesizeSpeech(
  text: string,
  voiceRole: 'host' | 'expert'
): Promise<Buffer> {
  const voice = voiceRole === 'expert' ? VOICE_EXPERT : VOICE_HOST;
  
  const tts = new EdgeTTS({
    voice: voice,
    lang: 'ur-PK',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
  });

  const tempFilePath = path.join(os.tmpdir(), `tts-${crypto.randomUUID()}.mp3`);
  
  try {
    const ttsPromise = tts.ttsPromise(text, tempFilePath);
    
    // Add a 30 second hard timeout for TTS generation to prevent infinite hanging
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Edge TTS timed out after 30s')), 30000);
    });
    
    await Promise.race([ttsPromise, timeoutPromise]).finally(() => clearTimeout(timer));
    
    const buffer = await fs.promises.readFile(tempFilePath);
    await fs.promises.unlink(tempFilePath).catch(console.error);
    return buffer;
  } catch (error) {
    console.error('[tts] Failed to synthesize chunk:', error);
    await fs.promises.unlink(tempFilePath).catch(() => {});
    throw error;
  }
}

/**
 * Merge multiple MP3 files into a single MP3 file safely using FFmpeg.
 * We specifically RE-ENCODE the audio to rebuild the MP3 Xing/Info frames.
 * If we don't re-encode, browsers will halt playback early because the concatenated 
 * stream will contain invalid duration metadata headers from the first chunk.
 */
async function mergeMp3Files(inputPaths: string[], outputPath: string) {
  const listFile = path.join(os.tmpdir(), `list-${crypto.randomUUID()}.txt`);
  const listContent = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  await fs.promises.writeFile(listFile, listContent);
  
  const ffmpegStatic = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  
  try {
    // Use libmp3lame to re-encode and ensure perfect duration headers for Chrome
    // Added -loglevel error to prevent Node.js exec maxBuffer from overflowing and hanging
    await execPromise(`"${ffmpegStatic}" -loglevel error -y -f concat -safe 0 -i "${listFile}" -c:a libmp3lame -b:a 48k -ar 24000 "${outputPath}"`);
  } finally {
    await fs.promises.unlink(listFile).catch(() => {});
  }
}

/**
 * Generate a complete MP3 podcast audio from a script.
 */
export async function generateFullAudio(
  script: ConversationScript,
  onProgress?: (percent: number) => void
): Promise<Buffer> {
  console.log(`[tts] Starting audio generation for script with ${script.turns.length} turns`);

  const tempFiles: string[] = [];
  const totalTurns = script.turns.length;

  try {
    for (let i = 0; i < totalTurns; i++) {
      const turn = script.turns[i];
      console.log(`[tts] Synthesizing turn ${i + 1}/${totalTurns} (${turn.speaker}): ${turn.text.slice(0, 30)}...`);

      const speechBuffer = await synthesizeSpeech(turn.text, turn.speaker);
      
      const speechFile = path.join(os.tmpdir(), `tts-speech-${crypto.randomUUID()}.mp3`);
      await fs.promises.writeFile(speechFile, speechBuffer);
      tempFiles.push(speechFile);

      // Add silence between turns
      if (i < totalTurns - 1) {
        const nextTurn = script.turns[i + 1];
        const silenceDuration = turn.speaker === nextTurn.speaker ? 500 : 800;
        
        const silenceFile = path.join(os.tmpdir(), `tts-silence-${crypto.randomUUID()}.mp3`);
        await fs.promises.writeFile(silenceFile, getSilenceBuffer(silenceDuration));
        tempFiles.push(silenceFile);
      }

      // Add a small delay between requests to prevent hammering the Microsoft Edge endpoint
      await new Promise(resolve => setTimeout(resolve, 300));

      if (onProgress) {
        const percent = Math.round(((i + 1) / totalTurns) * 100);
        onProgress(percent);
      }
    }

    console.log('[tts] Concatenating and RE-ENCODING audio parts with ffmpeg');
    const outputFilePath = path.join(os.tmpdir(), `tts-final-${crypto.randomUUID()}.mp3`);
    
    await mergeMp3Files(tempFiles, outputFilePath);
    const finalBuffer = await fs.promises.readFile(outputFilePath);
    
    // Cleanup
    await Promise.all([...tempFiles, outputFilePath].map(f => fs.promises.unlink(f).catch(() => {})));
    
    return finalBuffer;
  } catch (err) {
    console.warn(`[tts] Edge TTS synthesis failed. Throwing error upstream.`, err);
    // Clean up temporary files
    await Promise.all(tempFiles.map(f => fs.promises.unlink(f).catch(() => {})));
    throw new Error('Audio generation failed. The Microsoft TTS service might be busy or rate-limiting. Please try again.');
  }
}
