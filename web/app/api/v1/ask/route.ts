// POST /api/v1/ask - the one endpoint the Android app needs.
//
// Request:  { "question": "text", "location": { "lat": 37.22, "lng": -80.42 } }   (location is optional)
// Response: { answer, usedAgents, agents[], pins[], isSample, error }   (full shape in API.md)
//
// HTTP status: 400 only for a bad request body. Everything else is 200, and a backend failure
// shows up in the "error" field, so clients only need ONE code path.
import { runConcierge } from "@/lib/concierge";
import { summarizeEvents, type ConciergeEvent } from "@/lib/summarize";
import { json, optionsResponse } from "@/lib/cors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const question = body?.question;
  if (typeof question !== "string" || !question.trim()) {
    return json({ error: 'Send JSON like { "question": "..." }' }, 400);
  }

  const loc = body?.location;
  const location =
    typeof loc?.lat === "number" && typeof loc?.lng === "number" ? { lat: loc.lat, lng: loc.lng } : undefined;

  const events: ConciergeEvent[] = [];
  await runConcierge(question.trim(), (event, data) => events.push({ event, data }), { location });
  return json(summarizeEvents(events));
}
