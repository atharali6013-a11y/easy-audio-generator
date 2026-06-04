import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest, getUsersList } from '@/lib/db-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request (verifies user token)
    const user = await verifyRequest(request);

    // Fetch list of users registered in the database
    const users = await getUsersList();

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('[api/admin/users] Fetch failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve users' },
      { status: 500 }
    );
  }
}
