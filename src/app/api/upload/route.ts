import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyRequest, saveDocument, cleanupOldData } from '@/lib/db-client';
import { extractText } from '@/lib/text-extract';

export const maxDuration = 60; // Max 60 seconds duration for extraction

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await verifyRequest(request);

    // 2. Parse multi-part form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;

    console.log(`[api/upload] User ${user.uid} uploading file: ${fileName} (${fileSize} bytes)`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract text
    const textContent = await extractText(buffer, fileName);
    const charCount = textContent.length;

    console.log(`[api/upload] Extracted ${charCount} chars from ${fileName}`);

    // 4. Save document meta in DB (Supabase / Local)
    const documentId = crypto.randomUUID();

    await saveDocument({
      id: documentId,
      userId: user.uid,
      fileName,
      fileSize,
      charCount,
      textContent,
      uploadedAt: new Date(),
    });

    // 5. Fire auto-cleanup in background to remove old entries (older than 24 hours)
    cleanupOldData().catch((err) => {
      console.error('[api/upload] Auto cleanup error:', err);
    });

    return NextResponse.json({
      documentId,
      fileName,
      fileSize,
      charCount,
    });
  } catch (error) {
    console.error('[api/upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process document' },
      { status: 500 }
    );
  }
}
