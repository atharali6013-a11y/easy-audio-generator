import { NextRequest, NextResponse } from 'next/server';
import { getAudio, isSupabaseConfigured } from '@/lib/db-client';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const audioId = params.id;

  if (!audioId) {
    return NextResponse.json({ error: 'Missing audioId' }, { status: 400 });
  }

  try {
    console.log(`[api/audio] Fetching audio for ID: ${audioId}`);

    const data = await getAudio(audioId);

    if (!data) {
      return NextResponse.json({ error: 'Audio file metadata not found' }, { status: 404 });
    }

    if (!data.downloadUrl) {
      return NextResponse.json({ error: 'Download URL is missing' }, { status: 404 });
    }

    // Serve local file directly if download URL is relative or Supabase is not configured
    if (!isSupabaseConfigured || data.downloadUrl.startsWith('/')) {
      // Find file in public/uploads/
      const filename = `${audioId}.mp3`;
      const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
      
      if (!fs.existsSync(filePath)) {
        console.error(`[api/audio] Local file not found at path: ${filePath}`);
        return NextResponse.json({ error: 'Audio file not found on disk' }, { status: 404 });
      }

      // Read file buffer and return as response
      const buffer = await fs.promises.readFile(filePath);
      
      return new Response(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // Redirect directly to the Supabase public download URL in Cloud mode
    return NextResponse.redirect(new URL(data.downloadUrl));
  } catch (error) {
    console.error(`[api/audio] Error retrieving audio:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
