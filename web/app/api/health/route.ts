// GET /api/health - open this URL in the PHONE's browser to prove the phone can reach the backend.
import { AGENTS } from "@/lib/registry";
import { json, optionsResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return json({
    ok: true,
    service: "hokie-concierge",
    agents: AGENTS.map((a) => ({ id: a.id, name: a.name })),
    time: new Date().toISOString(),
  });
}
