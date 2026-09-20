// SPECIALIST AGENT: Dining.
// The main agent sends it a request (POST); it searches data/dining.json and answers.
import data from "@/data/dining.json";
import { handleAgentQuery } from "@/lib/agentRuntime";
import { getAgent } from "@/lib/registry";

export async function POST(req: Request) {
  return handleAgentQuery("dining", data, req);
}

// Open /api/agents/dining in the browser to see this agent's "business card".
export async function GET() {
  const a = getAgent("dining");
  return Response.json(a ? { id: a.id, name: a.name, description: a.description, rows: a.data.items.length } : null);
}
