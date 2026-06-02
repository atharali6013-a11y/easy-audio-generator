import { NextRequest } from 'next/server';
import { verifyToken, getJob } from '@/lib/db-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const token = searchParams.get('token');

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Missing jobId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Authenticate client
    await verifyToken(token);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Setup Server-Sent Events stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      console.log(`[api/progress] Starting SSE poll stream for job: ${jobId}`);
      
      let isClosed = false;

      // Poll database every 1.5 seconds
      const intervalId = setInterval(async () => {
        if (isClosed) return;

        try {
          const job = await getJob(jobId);
          if (job) {
            // Send progress update
            const chunk = `data: ${JSON.stringify(job)}\n\n`;
            controller.enqueue(encoder.encode(chunk));

            // Close stream on completion or error
            if (job.stage === 'complete' || job.stage === 'error') {
              cleanup();
            }
          }
        } catch (err: any) {
          console.error('[api/progress] DB polling error:', err);
          const chunk = `data: ${JSON.stringify({ stage: 'error', message: err.message || 'Database polling failed' })}\n\n`;
          controller.enqueue(encoder.encode(chunk));
          cleanup();
        }
      }, 1500);

      function cleanup() {
        if (isClosed) return;
        isClosed = true;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch (e) {
          // Ignore if already closed
        }
        console.log(`[api/progress] Closed SSE stream for job: ${jobId}`);
      }

      // Clean up when client closes connection
      request.signal.addEventListener('abort', () => {
        console.log(`[api/progress] Client aborted SSE stream for job: ${jobId}`);
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
