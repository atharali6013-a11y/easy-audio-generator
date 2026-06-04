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

  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === 'true';

  try {
    console.log(`[api/audio] Fetching audio for ID: ${audioId}, download: ${isDownload}`);

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
      
      const headers: Record<string, string> = {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
      };

      if (isDownload) {
        let downloadFileName = `${audioId}.mp3`;
        if (data.fileName) {
          const lastDotIndex = data.fileName.lastIndexOf('.');
          const baseName = lastDotIndex !== -1 ? data.fileName.substring(0, lastDotIndex) : data.fileName;
          const cleanBaseName = baseName.replace(/["\\/]/g, '_').trim();
          downloadFileName = `${cleanBaseName}.mp3`;
        }
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(downloadFileName)}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`;
      }

      return new Response(buffer, { headers });
    }

    // In Cloud mode (Supabase):
    // If the user requested download, fetch the file from Supabase and serve it with Content-Disposition attachment.
    // This bypasses same-origin browser download restrictions for cross-origin URLs.
    if (isDownload) {
      console.log(`[api/audio] Fetching file from Supabase for forced download: ${data.downloadUrl}`);
      const response = await fetch(data.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio from Supabase: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let downloadFileName = `${audioId}.mp3`;
      if (data.fileName) {
        const lastDotIndex = data.fileName.lastIndexOf('.');
        const baseName = lastDotIndex !== -1 ? data.fileName.substring(0, lastDotIndex) : data.fileName;
        const cleanBaseName = baseName.replace(/["\\/]/g, '_').trim();
        downloadFileName = `${cleanBaseName}.mp3`;
      }

      return new Response(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFileName)}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    // Otherwise, redirect directly to the Supabase public URL for normal streaming/playback
    return NextResponse.redirect(new URL(data.downloadUrl));
  } catch (error) {
    console.error(`[api/audio] Error retrieving audio:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
