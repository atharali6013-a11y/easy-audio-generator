import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Configuration Detectors
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Storage modes
const isSupabaseMode = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const isR2Mode = 
  !isSupabaseMode && 
  !!(R2_ACCOUNT_ID && 
     R2_ACCOUNT_ID !== 'your-cloudflare-account-id' &&
     R2_ACCESS_KEY_ID &&
     R2_ACCESS_KEY_ID !== 'your-r2-access-key-id');

// Initialize Supabase Client
const supabase = isSupabaseMode
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    })
  : null;

// Initialize S3 Client (for R2)
const s3Client = isR2Mode
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Helper to ensure a public bucket exists in Supabase.
 */
async function ensureSupabaseBucket(bucketName: string) {
  if (!supabase) return;
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn('[storage] Error listing buckets:', listError.message);
      return;
    }
    const bucketExists = buckets && buckets.some(b => b.name === bucketName);
    if (!bucketExists) {
      console.log(`[storage] Creating public Supabase storage bucket: ${bucketName}`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
      });
      if (createError) {
        console.error(`[storage] Failed to create bucket ${bucketName}:`, createError.message);
      }
    }
  } catch (err) {
    console.warn('[storage] Failed to verify storage bucket:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the public access URL for a given storage key.
 */
export function getAudioUrl(key: string): string {
  if (isSupabaseMode && supabase) {
    const { data } = supabase.storage.from('audios').getPublicUrl(key);
    return data.publicUrl;
  }

  if (isR2Mode) {
    if (!R2_PUBLIC_URL) {
      throw new Error('R2_PUBLIC_URL environment variable is not defined');
    }
    const cleanBase = R2_PUBLIC_URL.endsWith('/') ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
    return `${cleanBase}/${key}`;
  }

  // Fallback to local mode relative URL
  const filename = path.basename(key);
  return `/uploads/${filename}`;
}

/**
 * Uploads an audio buffer to active storage backend and returns its public URL.
 */
export async function uploadAudio(buffer: Buffer, key: string): Promise<string> {
  const filename = path.basename(key);

  // 1. Supabase Mode
  if (isSupabaseMode && supabase) {
    console.log(`[storage] Supabase Mode active. Ensuring bucket 'audios' exists and uploading: ${key}`);
    await ensureSupabaseBucket('audios');

    const { data, error } = await supabase.storage
      .from('audios')
      .upload(key, buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      console.error(`[storage] Supabase upload failed for ${key}:`, error);
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const publicUrl = getAudioUrl(key);
    console.log(`[storage] Successfully uploaded audio to Supabase. Public URL: ${publicUrl}`);
    return publicUrl;
  }

  // 2. Cloudflare R2 Mode
  if (isR2Mode && s3Client) {
    console.log(`[storage] R2 Mode active. Uploading audio to R2: ${key} (${buffer.length} bytes)`);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    });

    try {
      await s3Client.send(command);
      console.log(`[storage] Successfully uploaded audio to R2: ${key}`);
      return getAudioUrl(key);
    } catch (error) {
      console.error(`[storage] Failed to upload audio to R2: ${key}`, error);
      throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 3. Local Fallback Mode
  console.log(`[storage] Local Fallback active. Saving locally to public/uploads/${filename}`);
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  console.log(`[storage] Local file saved successfully at ${filePath}`);
  
  return `/uploads/${filename}`;
}
