// Event-list version (kept for compatibility). New clients should use POST /api/v1/ask instead.
// Waits for the whole run, then returns every event in order:
//   { "events": [ { "event": "plan", "data": {...} }, { "event": "verify", ... }, ... ] }
import { runConcierge } from "@/lib/concierge";
import { json, optionsResponse } from "@/lib/cors";

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

  const events: { event: string; data: unknown }[] = [];
  await runConcierge(question, (event, data) => events.push({ event, data }));
  return json({ events });
}
