/**
 * Format seconds into mm:ss display string.
 * @param seconds - Number of seconds (can be fractional)
 * @returns Formatted time string like "03:45"
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';

  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format bytes into a human-readable file size string.
 * @param bytes - File size in bytes
 * @returns Formatted string like "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown';

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Extract the first name from a full display name.
 * @param displayName - Full name string (e.g. "Ali Athar")
 * @returns First name or "there" as fallback
 */
export function getFirstName(displayName: string | null | undefined): string {
  if (!displayName || !displayName.trim()) return 'there';
  return displayName.trim().split(/\s+/)[0];
}

/**
 * Generate a unique ID using crypto.randomUUID with fallback.
 * @returns A unique string identifier
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/**
 * Clamp a number between min and max values.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get a file type icon emoji based on file extension.
 */
export function getFileTypeIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, string> = {
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    txt: '📄',
    ppt: '📙',
    pptx: '📙',
  };
  return iconMap[ext] ?? '📎';
}
