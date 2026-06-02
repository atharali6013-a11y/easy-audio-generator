// ============================================
// Easy Audio Generator — Document Text Extraction
// ============================================
// Extracts plain text from PDF, DOCX, DOC, TXT, PPT, and PPTX files.
// No character limits — returns the full extracted text.

import path from 'path';
import type { SupportedExtension } from '@/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract text content from a document buffer.
 *
 * @param buffer  - The raw file buffer
 * @param fileName - Original file name (used to detect type by extension)
 * @returns The cleaned extracted text
 * @throws Error for unsupported formats or extraction failures
 */
export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase() as SupportedExtension;

  let rawText: string;

  switch (ext) {
    case '.pdf':
      rawText = await extractFromPdf(buffer);
      break;

    case '.docx':
    case '.doc':
      rawText = await extractFromWord(buffer);
      break;

    case '.txt':
      rawText = extractFromTxt(buffer);
      break;

    case '.ppt':
    case '.pptx':
      rawText = await extractFromPowerPoint(buffer);
      break;

    default:
      throw new Error(
        `Unsupported file format: "${ext}". ` +
          'Supported formats: PDF, DOCX, DOC, TXT, PPT, PPTX'
      );
  }

  const cleaned = cleanText(rawText);

  if (!cleaned || cleaned.length === 0) {
    throw new Error(
      'No text could be extracted from the document. ' +
        'The file may be empty, image-only, or corrupted.'
    );
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Format-specific extractors
// ---------------------------------------------------------------------------

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse is a CommonJS module
  const pdfParse = (await import('pdf-parse')).default;

  try {
    const data = await pdfParse(buffer, {
      // Limit to reasonable page count to avoid hanging on massive PDFs
      max: 0, // 0 = no limit
    });

    return data.text || '';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF extraction failed: ${msg}`);
  }
}

async function extractFromWord(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');

  try {
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      const warnings = result.messages
        .filter((m) => m.type === 'warning')
        .map((m) => m.message);
      if (warnings.length > 0) {
        console.warn('[text-extract] Word extraction warnings:', warnings);
      }
    }

    return result.value || '';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Word document extraction failed: ${msg}`);
  }
}

function extractFromTxt(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

async function extractFromPowerPoint(buffer: Buffer): Promise<string> {
  const officeparser = await import('officeparser');

  try {
    const text = await officeparser.parseOfficeAsync(buffer);
    return text || '';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`PowerPoint extraction failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Text cleaning utilities
// ---------------------------------------------------------------------------

/**
 * Clean extracted text by normalizing whitespace, removing control characters,
 * and trimming excessive blank lines.
 */
function cleanText(text: string): string {
  return (
    text
      // Remove null bytes and most control characters (keep \n \r \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize various Unicode whitespace to regular spaces
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      // Collapse multiple spaces (but not newlines) into one
      .replace(/[^\S\n]+/g, ' ')
      // Collapse 3+ consecutive newlines into 2
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace from each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Final trim
      .trim()
  );
}
