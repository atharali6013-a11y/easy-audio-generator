import { NextRequest, NextResponse } from 'next/server';
import { getAudioByShareId, isSupabaseConfigured } from '@/lib/db-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const shareId = params.id;

  if (!shareId) {
    return NextResponse.json({ error: 'Missing shareId' }, { status: 400 });
  }

  try {
    console.log(`[api/share] Looking up audio share ID: ${shareId}`);

    // Query DB for audio file metadata matching shareId
    const data = await getAudioByShareId(shareId);

    if (!data) {
      return NextResponse.json({ error: 'Audio overview not found' }, { status: 404 });
    }

    // Serve via local API proxy only if Supabase is NOT configured (or url is local)
    const downloadUrl = !isSupabaseConfigured || data.downloadUrl.startsWith('/')
      ? `/api/audio/${data.id}`
      : data.downloadUrl;

    return NextResponse.json({
      title: data.title,
      downloadUrl,
      fileName: data.fileName,
      createdAt: data.generatedAt instanceof Date ? data.generatedAt.toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[api/share] Error looking up share ${shareId}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
