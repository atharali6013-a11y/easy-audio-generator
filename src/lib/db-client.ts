import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { verifyToken as verifyFirebaseToken, isAdminLocalMode } from '@/lib/firebase-admin';

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
// Debug Logs Operations
// ---------------------------------------------------------------------------

export interface DebugLog {
  id: string;
  userId?: string;
  timestamp: Date | string;
  stage?: string;
  message: string;
  stack?: string;
  context?: any;
}

function mapDebugLogToDb(log: DebugLog) {
  return {
    id: log.id,
    user_id: log.userId || null,
    timestamp: typeof log.timestamp === 'string' ? log.timestamp : (log.timestamp || new Date()).toISOString(),
    stage: log.stage || null,
    message: log.message,
    stack: log.stack || null,
    context: log.context || null
  };
}

function mapDbToDebugLog(row: any): DebugLog | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: new Date(row.timestamp),
    stage: row.stage,
    message: row.message,
    stack: row.stack,
    context: row.context
  };
}

export async function saveDebugLog(log: Omit<DebugLog, 'id' | 'timestamp'> & { id?: string; timestamp?: Date | string }): Promise<void> {
  const finalLog: DebugLog = {
    id: log.id || crypto.randomUUID(),
    timestamp: log.timestamp || new Date(),
    userId: log.userId,
    stage: log.stage,
    message: log.message,
    stack: log.stack,
    context: log.context
  };

  try {
    let savedInSupabase = false;
    if (isSupabaseConfigured && supabase) {
      const dbRow = mapDebugLogToDb(finalLog);
      const { error } = await supabase.from('debug_logs').upsert(dbRow);
      if (!error) {
        savedInSupabase = true;
      } else if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Table doesn't exist — fall back to jobs table with prefix key
        console.warn('[db-client] debug_logs table not found, using jobs table fallback');
        const ts = typeof finalLog.timestamp === 'string' ? finalLog.timestamp : finalLog.timestamp.toISOString();
        const jobsRow = {
          id: `_log_${finalLog.id}`,
          stage: finalLog.stage || 'client',
          percent: 0,
          message: finalLog.message,
          error: finalLog.stack || null,
          audio: { user_id: finalLog.userId, timestamp: ts, context: finalLog.context, stack: finalLog.stack },
          updated_at: ts,
        };
        const { error: jobsErr } = await supabase.from('jobs').upsert(jobsRow);
        if (!jobsErr) {
          savedInSupabase = true;
        } else {
          console.warn('[db-client] jobs fallback for debug_logs also failed:', jobsErr.message);
        }
      } else {
        console.warn('[db-client] Supabase debug_logs save failed, falling back to local:', error.message);
      }
    }
    
    if (!savedInSupabase) {
      loadLocalDb();
      if (!localDbStore.debug_logs) localDbStore.debug_logs = {};
      localDbStore.debug_logs[finalLog.id] = {
        ...finalLog,
        timestamp: typeof finalLog.timestamp === 'string' ? finalLog.timestamp : finalLog.timestamp.toISOString(),
      };
      saveLocalDb();
    }
  } catch (err) {
    console.error('[db-client] Exception in saveDebugLog:', err);
  }
}

export async function getDebugLogs(limit = 100): Promise<DebugLog[]> {
  try {
    if (isSupabaseConfigured && supabase) {
      // Try debug_logs table first
      const { data, error } = await supabase
        .from('debug_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (!error) {
        return (data || []).map(row => mapDbToDebugLog(row)).filter((l): l is DebugLog => l !== null);
      }
      
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Table doesn't exist — read from jobs table with prefix key
        console.warn('[db-client] debug_logs table not found, using jobs table fallback');
        const { data: jobsData, error: jobsErr } = await supabase
          .from('jobs')
          .select('*')
          .like('id', '_log_%')
          .order('updated_at', { ascending: false })
          .limit(limit);
        if (!jobsErr && jobsData) {
          return jobsData.map((row: any) => {
            const payload = row.audio || {};
            return {
              id: row.id.replace('_log_', ''),
              userId: payload.user_id || null,
              timestamp: new Date(payload.timestamp || row.updated_at),
              stage: row.stage,
              message: row.message,
              stack: payload.stack || row.error || null,
              context: payload.context || null,
            } as DebugLog;
          });
        }
      }
      console.warn('[db-client] Supabase getDebugLogs failed, falling back to local:', error.message);
    }
    
    loadLocalDb();
    const logs = Object.values(localDbStore.debug_logs || {}) as any[];
    return logs
      .map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  } catch (err) {
    console.error('[db-client] Exception in getDebugLogs:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 24-Hour Auto-Cleanup Operation
// ---------------------------------------------------------------------------

export async function cleanupOldData(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const cutoffIso = cutoff.toISOString();
  
  const cutoffLog = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago for debug logs
  const cutoffLogIso = cutoffLog.toISOString();

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

      // 2. Delete database rows older than 24 hours (logs 48h)
      const { error: dbDocErr } = await supabase.from('documents').delete().lt('uploaded_at', cutoffIso);
      const { error: dbJobErr } = await supabase.from('jobs').delete().lt('updated_at', cutoffIso);
      const { error: dbAudioErr } = await supabase.from('audios').delete().lt('generated_at', cutoffIso);
      const { error: dbLogErr } = await supabase.from('debug_logs').delete().lt('timestamp', cutoffLogIso);

      if (dbDocErr || dbJobErr || dbAudioErr || dbLogErr) {
        console.error('[db-client] Cleanup: DB deletion errors:', { dbDocErr, dbJobErr, dbAudioErr, dbLogErr });
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
    const twoDaysMs = 48 * 60 * 60 * 1000;

    let deletedDocs = 0;
    let deletedJobs = 0;
    let deletedAudios = 0;
    let deletedLogs = 0;

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

    // Clean debug logs
    if (localDbStore.debug_logs) {
      for (const [id, log] of Object.entries(localDbStore.debug_logs)) {
        if (now - new Date(log.timestamp).getTime() > twoDaysMs) {
          delete localDbStore.debug_logs[id];
          deletedLogs++;
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

    if (deletedDocs > 0 || deletedJobs > 0 || deletedAudios > 0 || deletedLogs > 0) {
      console.log(`[db-client] Cleanup: Deleted local entries: ${deletedDocs} docs, ${deletedJobs} jobs, ${deletedAudios} audios, ${deletedLogs} logs.`);
      saveLocalDb();
    }
  }
}

// ---------------------------------------------------------------------------
// User Profiles Operations
// ---------------------------------------------------------------------------

export async function saveUser(user: { id: string; email: string; name: string }): Promise<void> {
  const dbRow = {
    id: user.id,
    email: user.email,
    name: user.name,
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  try {
    let savedInSupabase = false;
    if (isSupabaseConfigured && supabase) {
      // Try users table first
      const { error } = await supabase.from('users').upsert(dbRow, { onConflict: 'id' });
      if (!error) {
        savedInSupabase = true;
      } else if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Table doesn't exist — fall back to jobs table with prefix key
        console.warn('[db-client] users table not found, using jobs table fallback');
        const jobsRow = {
          id: `_user_${user.id}`,
          stage: 'user_profile',
          percent: 0,
          message: `${user.name} <${user.email}>`,
          audio: dbRow,
          updated_at: new Date().toISOString(),
        };
        const { error: jobsErr } = await supabase.from('jobs').upsert(jobsRow);
        if (!jobsErr) {
          savedInSupabase = true;
        } else {
          console.warn('[db-client] jobs fallback for users also failed:', jobsErr.message);
        }
      } else {
        console.warn('[db-client] Supabase users upsert failed, falling back to local:', error.message);
      }
    }
    
    if (!savedInSupabase) {
      loadLocalDb();
      if (!localDbStore.users) localDbStore.users = {};
      const existing = localDbStore.users[user.id] || {};
      localDbStore.users[user.id] = {
        ...existing,
        ...dbRow,
        created_at: existing.created_at || dbRow.created_at,
      };
      saveLocalDb();
    }
  } catch (err) {
    console.error('[db-client] Exception in saveUser:', err);
  }
}

export async function getUsersList(): Promise<any[]> {
  try {
    if (isSupabaseConfigured && supabase) {
      // Try users table first
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('last_seen_at', { ascending: false });
      if (!error) {
        return data || [];
      }
      
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Table doesn't exist — read from jobs table with prefix key
        console.warn('[db-client] users table not found, using jobs table fallback');
        const { data: jobsData, error: jobsErr } = await supabase
          .from('jobs')
          .select('*')
          .like('id', '_user_%')
          .order('updated_at', { ascending: false });
        if (!jobsErr && jobsData) {
          return jobsData.map((row: any) => row.audio || {}).filter((u: any) => u.id);
        }
      }
      console.warn('[db-client] Supabase getUsersList failed, falling back to local:', error.message);
    }
    
    loadLocalDb();
    const users = Object.values(localDbStore.users || {});
    return users.sort((a: any, b: any) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
  } catch (err) {
    console.error('[db-client] Exception in getUsersList:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Authentication Verification Helper
// ---------------------------------------------------------------------------

export async function verifyToken(token: string): Promise<VerifiedUser> {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  // Check if it's a mock token for local offline testing
  if (token.startsWith('mock-google-token-')) {
    const mockEmail = token.replace('mock-google-token-', '');
    const user = {
      uid: `mock-uid-${mockEmail}`,
      email: mockEmail,
      name: mockEmail.split('@')[0],
    };
    await saveUser({ id: user.uid, email: user.email, name: user.name }).catch(console.error);
    return user;
  }

  // Call the Firebase admin verification
  try {
    const verified = await verifyFirebaseToken(token);
    // Save/update user profile in DB
    await saveUser({ id: verified.uid, email: verified.email || '', name: verified.name || 'User' }).catch(console.error);
    return verified;
  } catch (err: any) {
    // Fallback to guest if offline local mode or guest token
    if (isAdminLocalMode || token === 'guest-token-id' || token === 'dummy-token-for-testing') {
      const user = {
        uid: 'guest-ali-athar',
        email: 'ali.athar@guest.interface',
        name: 'Mr. Ali Athar',
      };
      await saveUser({ id: user.uid, email: user.email, name: user.name }).catch(console.error);
      return user;
    }
    throw err;
  }
}

export async function verifyRequest(request: Request): Promise<VerifiedUser> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  const token = authHeader.slice(7);
  return verifyToken(token);
}
