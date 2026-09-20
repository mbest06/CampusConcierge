// Dining agent, running inside the Next.js app. Reads web/data/dining.json.
import data from "@/data/dining.json";
import { handleAgentQuery, type DataFile } from "@/lib/agentSearch";

export async function POST(req: Request) {
  return handleAgentQuery("dining", data as unknown as DataFile, req);
}
