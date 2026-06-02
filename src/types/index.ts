// ============================================
// Easy Audio Generator — Shared Type Definitions
// ============================================

/** A single turn in the podcast conversation */
export interface ConversationTurn {
  speaker: 'host' | 'expert';
  text: string;
}

/** The full conversation script produced by the LLM */
export interface ConversationScript {
  title: string;
  turns: ConversationTurn[];
}

/** Document metadata stored in Firestore /documents/{docId} */
export interface DocumentRecord {
  userId: string;
  fileName: string;
  fileSize: number;
  textContent: string;
  charCount: number;
  uploadedAt: FirebaseFirestore.Timestamp | Date;
}

/** Generation job stored in Firestore /jobs/{jobId} */
export interface GenerationJob {
  userId: string;
  documentId: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  stage: JobStage;
  percent: number;
  message: string;
  audioId?: string;
  shareId?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: FirebaseFirestore.Timestamp | Date;
  updatedAt: FirebaseFirestore.Timestamp | Date;
}

/** Pipeline stages for progress tracking */
export type JobStage =
  | 'pending'
  | 'extracting'
  | 'summarizing'
  | 'generating_audio'
  | 'uploading'
  | 'complete'
  | 'error';

/** Audio record stored in Firestore /audios/{audioId} */
export interface AudioRecord {
  userId: string;
  documentId: string;
  jobId: string;
  shareId: string;
  title: string;
  downloadUrl: string;
  fileSize: number;
  durationEstimate?: number;
  createdAt: FirebaseFirestore.Timestamp | Date;
}

/** SSE progress event payload */
export interface ProgressEvent {
  stage: JobStage;
  percent: number;
  message: string;
}

/** Upload API response */
export interface UploadResponse {
  documentId: string;
  fileName: string;
  fileSize: number;
  charCount: number;
}

/** Generate API response */
export interface GenerateResponse {
  jobId: string;
  audioId?: string;
  shareId?: string;
  downloadUrl?: string;
}

/** Share API response */
export interface ShareResponse {
  title: string;
  downloadUrl: string;
  fileSize: number;
  createdAt: string;
}

/** Supported file extensions for document upload */
export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.ppt',
  '.pptx',
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
