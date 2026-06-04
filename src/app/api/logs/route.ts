import { NextRequest, NextResponse } from 'next/server';
import { saveDebugLog, getDebugLogs } from '@/lib/db-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, stage, message, stack, context } = body;
    
    await saveDebugLog({
      userId: userId || 'anonymous',
      stage: stage || 'client',
      message: message || 'No error message provided',
      stack: stack || null,
      context: context || null
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/logs] Error saving client-side debug log:', error);
    return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Retrieve the logs (secured/accessed via endpoint)
    const logs = await getDebugLogs(100);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[api/logs] Error fetching debug logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
