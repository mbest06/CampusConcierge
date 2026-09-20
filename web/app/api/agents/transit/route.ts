// SPECIALIST AGENT: Transit.
// The main agent sends it a request (POST); it searches data/transit.json and answers.
import data from "@/data/transit.json";
import { handleAgentQuery } from "@/lib/agentRuntime";
import { getAgent } from "@/lib/registry";

export async function POST(req: Request) {
  return handleAgentQuery("transit", data, req);
}

// Open /api/agents/transit in the browser to see this agent's "business card".
export async function GET() {
  const a = getAgent("transit");
  return Response.json(a ? { id: a.id, name: a.name, description: a.description, rows: a.data.items.length } : null);
}
