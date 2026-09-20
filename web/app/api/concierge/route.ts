// Streaming version (Server-Sent Events). Best for a browser UI.
// Native Android apps should use POST /api/v1/ask instead (simpler, no stream parsing).
import { runConcierge } from "@/lib/concierge";
import { CORS_HEADERS, json, optionsResponse } from "@/lib/cors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question || typeof question !== "string") {
    return json({ error: 'Send JSON like { "question": "..." }' }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await runConcierge(question, send);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
