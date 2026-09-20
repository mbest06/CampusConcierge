// The door the web page knocks on: POST { "question": "..." } -> the main agent's full answer.
import { runConcierge } from "@/lib/concierge";
import { logExchange } from "@/lib/atlas";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: 'Send JSON like { "question": "..." }' }, { status: 400 });
  }

  // The main agent calls the specialist agents over HTTP at this same site.
  const origin = new URL(req.url).origin;
  const result = await runConcierge(question, origin);

  if (!result.error) await logExchange(question, result.answer, result.usedAgents); // no-op unless Atlas is set up
  return Response.json(result);
}
