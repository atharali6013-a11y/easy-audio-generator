import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentMeta {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  charCount: number;
  textContent: string;
  uploadedAt: Date | string;
}

export interface JobState {
  id: string;
  stage: string;
  percent: number;
  message: string;
  audio?: any;
  error?: string;
  updatedAt: Date | string;
}

export interface AudioMeta {
  id: string;
  shareId: string;
  userId: string;
  fileName: string;
  downloadUrl: string;
  title: string;
  generatedAt: Date | string;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Client Setup
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    })
  : null;

// ---------------------------------------------------------------------------
// Local Persistence Setup (Mock DB Fallback)
// ---------------------------------------------------------------------------

const DB_FILE = path.join(process.cwd(), 'db.json');
let localDbStore: Record<string, Record<string, any>> = {};

function loadLocalDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      localDbStore = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('[db-client] Failed to parse local JSON db:', e);
      localDbStore = {};
    }
  } else {
    localDbStore = {};
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDbStore, null, 2), 'utf-8');
  } catch (e) {
    console.error('[db-client] Failed to write local JSON db:', e);
  }
}

// Initialize local DB cache
if (!isSupabaseConfigured) {
  loadLocalDb();
}

// ---------------------------------------------------------------------------
// Mappings (CamelCase JS to SnakeCase SQL Database)
// ---------------------------------------------------------------------------

function mapDocumentToDb(doc: DocumentMeta) {
  return {
    id: doc.id,
    user_id: doc.userId,
    file_name: doc.fileName,
    file_size: doc.fileSize,
    char_count: doc.charCount,
    text_content: doc.textContent,
    uploaded_at: typeof doc.uploadedAt === 'string' ? doc.uploadedAt : (doc.uploadedAt?.toISOString() || new Date().toISOString()),
  };
}

function mapDbToDocument(row: any): DocumentMeta | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    charCount: row.char_count,
    textContent: row.text_content,
    uploadedAt: new Date(row.uploaded_at),
  };
}

function mapJobToDb(job: Partial<JobState> & { id: string }) {
  const dbRow: any = { id: job.id };
  if (job.stage !== undefined) dbRow.stage = job.stage;
  if (job.percent !== undefined) dbRow.percent = job.percent;
  if (job.message !== undefined) dbRow.message = job.message;
  if (job.audio !== undefined) dbRow.audio = job.audio || null;
  if (job.error !== undefined) dbRow.error = job.error || null;
  dbRow.updated_at = typeof job.updatedAt === 'string' ? job.updatedAt : (job.updatedAt || new Date()).toISOString();
  return dbRow;
}

function mapDbToJob(row: any): JobState | null {
  if (!row) return null;
  return {
    id: row.id,
    stage: row.stage,
    percent: row.percent,
    message: row.message,
    audio: row.audio,
    error: row.error,
    updatedAt: new Date(row.updated_at),
  };
}

function mapAudioToDb(audio: AudioMeta) {
  return {
    id: audio.id,
    share_id: audio.shareId,
    user_id: audio.userId,
    file_name: audio.fileName,
    download_url: audio.downloadUrl,
    title: audio.title,
    generated_at: typeof audio.generatedAt === 'string' ? audio.generatedAt : (audio.generatedAt?.toISOString() || new Date().toISOString()),
  };
}

function mapDbToAudio(row: any): AudioMeta | null {
  if (!row) return null;
  return {
    id: row.id,
    shareId: row.share_id,
    userId: row.user_id,
    fileName: row.file_name,
    downloadUrl: row.download_url,
    title: row.title,
    generatedAt: new Date(row.generated_at),
  };
}

// ---------------------------------------------------------------------------
// Database API Exports
// ---------------------------------------------------------------------------

// Documents Operations
export async function saveDocument(doc: DocumentMeta): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const dbRow = mapDocumentToDb(doc);
    const { error } = await supabase.from('documents').upsert(dbRow);
    if (error) {
      console.error('[db-client] Error saving document to Supabase:', error);
      throw new Error(`Failed to save document in Supabase: ${error.message}`);
    }
  } else {
    loadLocalDb();
    if (!localDbStore.documents) localDbStore.documents = {};
    localDbStore.documents[doc.id] = {
      ...doc,
      uploadedAt: typeof doc.uploadedAt === 'string' ? doc.uploadedAt : doc.uploadedAt.toISOString(),
    };
    saveLocalDb();
  }
}

export async function getDocument(id: string): Promise<DocumentMeta | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('[db-client] Error fetching document from Supabase:', error);
      return null;
    }
    return mapDbToDocument(data);
  } else {
    loadLocalDb();
    const doc = localDbStore.documents?.[id];
    if (!doc) return null;
    return {
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
    };
  }
}

// Jobs Operations
export async function saveJob(job: Partial<JobState> & { id: string }): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const dbRow = mapJobToDb(job);
    const { error } = await supabase.from('jobs').upsert(dbRow);
    if (error) {
      console.error('[db-client] Error saving job to Supabase:', error);
      throw new Error(`Failed to save job in Supabase: ${error.message}`);
    }
  } else {
    loadLocalDb();
    if (!localDbStore.jobs) localDbStore.jobs = {};
    const existing = localDbStore.jobs[job.id] || {};
    localDbStore.jobs[job.id] = {
      ...existing,
      ...job,
      updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : (job.updatedAt || new Date()).toISOString(),
    };
    saveLocalDb();
  }
}

export async function getJob(id: string): Promise<JobState | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('[db-client] Error fetching job from Supabase:', error);
      return null;
    }
    return mapDbToJob(data);
  } else {
    loadLocalDb();
    const job = localDbStore.jobs?.[id];
    if (!job) return null;
    return {
      ...job,
      updatedAt: new Date(job.updatedAt),
    };
  }
}

// Audios Operations
export async function saveAudio(audio: AudioMeta): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const dbRow = mapAudioToDb(audio);
    const { error } = await supabase.from('audios').upsert(dbRow);
    if (error) {
      console.error('[db-client] Error saving audio to Supabase:', error);
      throw new Error(`Failed to save audio in Supabase: ${error.message}`);
    }
  } else {
    loadLocalDb();
    if (!localDbStore.audios) localDbStore.audios = {};
    localDbStore.audios[audio.id] = {
      ...audio,
      generatedAt: typeof audio.generatedAt === 'string' ? audio.generatedAt : audio.generatedAt.toISOString(),
    };
    saveLocalDb();
  }
}

export async function getAudio(id: string): Promise<AudioMeta | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('audios').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('[db-client] Error fetching audio from Supabase:', error);
      return null;
    }
    return mapDbToAudio(data);
  } else {
    loadLocalDb();
    const audio = localDbStore.audios?.[id];
    if (!audio) return null;
    return {
      ...audio,
      generatedAt: new Date(audio.generatedAt),
    };
  }
}

export async function getAudioByShareId(shareId: string): Promise<AudioMeta | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('audios').select('*').eq('share_id', shareId).limit(1).maybeSingle();
    if (error) {
      console.error('[db-client] Error fetching audio by shareId from Supabase:', error);
      return null;
    }
    return mapDbToAudio(data);
  } else {
    loadLocalDb();
    const audios = localDbStore.audios || {};
    for (const audio of Object.values(audios)) {
      if (audio.shareId === shareId) {
        return {
          ...audio,
          generatedAt: new Date(audio.generatedAt),
        };
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// 24-Hour Auto-Cleanup Operation
// ---------------------------------------------------------------------------

export async function cleanupOldData(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const cutoffIso = cutoff.toISOString();

  console.log(`[db-client] Running auto-cleanup for entries older than 24 hours (before ${cutoffIso})`);

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Fetch audios older than 24 hours to delete their storage files
      const { data: oldAudios, error: fetchErr } = await supabase
        .from('audios')
        .select('id')
        .lt('generated_at', cutoffIso);

      if (fetchErr) {
        console.error('[db-client] Cleanup: Failed to fetch old audios:', fetchErr);
      } else if (oldAudios && oldAudios.length > 0) {
        const storageKeys = oldAudios.map(audio => `audios/${audio.id}.mp3`);
        console.log(`[db-client] Cleanup: Deleting ${storageKeys.length} files from Supabase Storage:`, storageKeys);
        
        const { error: storageDeleteErr } = await supabase.storage
          .from('audios')
          .remove(storageKeys);

        if (storageDeleteErr) {
          console.error('[db-client] Cleanup: Storage deletion error:', storageDeleteErr);
        }
      }

      // 2. Delete database rows older than 24 hours
      const { error: dbDocErr } = await supabase.from('documents').delete().lt('uploaded_at', cutoffIso);
      const { error: dbJobErr } = await supabase.from('jobs').delete().lt('updated_at', cutoffIso);
      const { error: dbAudioErr } = await supabase.from('audios').delete().lt('generated_at', cutoffIso);

      if (dbDocErr || dbJobErr || dbAudioErr) {
        console.error('[db-client] Cleanup: DB deletion errors:', { dbDocErr, dbJobErr, dbAudioErr });
      } else {
        console.log('[db-client] Cleanup completed successfully on Supabase.');
      }
    } catch (err) {
      console.error('[db-client] Cleanup failed:', err);
    }
  } else {
    // Local JSON fallback cleanup
    loadLocalDb();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let deletedDocs = 0;
    let deletedJobs = 0;
    let deletedAudios = 0;

    // Clean documents
    if (localDbStore.documents) {
      for (const [id, doc] of Object.entries(localDbStore.documents)) {
        if (now - new Date(doc.uploadedAt).getTime() > oneDayMs) {
          delete localDbStore.documents[id];
          deletedDocs++;
        }
      }
    }

    // Clean jobs
    if (localDbStore.jobs) {
      for (const [id, job] of Object.entries(localDbStore.jobs)) {
        if (now - new Date(job.updatedAt).getTime() > oneDayMs) {
          delete localDbStore.jobs[id];
          deletedJobs++;
        }
      }
    }

    // Clean audios and delete their local files
    if (localDbStore.audios) {
      for (const [id, audio] of Object.entries(localDbStore.audios)) {
        if (now - new Date(audio.generatedAt).getTime() > oneDayMs) {
          delete localDbStore.audios[id];
          deletedAudios++;

          // Delete local file if it exists
          const filePath = path.join(process.cwd(), 'public', 'uploads', `${id}.mp3`);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`[db-client] Cleanup: Deleted local file ${filePath}`);
            } catch (err) {
              console.error(`[db-client] Cleanup: Failed to delete local file ${filePath}:`, err);
            }
          }
        }
      }
    }

    if (deletedDocs > 0 || deletedJobs > 0 || deletedAudios > 0) {
      console.log(`[db-client] Cleanup: Deleted local entries: ${deletedDocs} docs, ${deletedJobs} jobs, ${deletedAudios} audios.`);
      saveLocalDb();
    }
  }
}

// ---------------------------------------------------------------------------
// Authentication Verification Helper (Guest mode by default)
// ---------------------------------------------------------------------------

export async function verifyToken(token: string): Promise<VerifiedUser> {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  return {
    uid: 'guest-ali-athar',
    name: 'Mr. Ali Athar',
    email: 'ali.athar@guest.interface',
  };
}

export async function verifyRequest(request: Request): Promise<VerifiedUser> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  const token = authHeader.slice(7);
  return verifyToken(token);
}
