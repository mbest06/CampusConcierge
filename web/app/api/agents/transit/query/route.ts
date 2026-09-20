// Transit agent, running inside the Next.js app. Reads web/data/transit.json.
import data from "@/data/transit.json";
import { handleAgentQuery, type DataFile } from "@/lib/agentSearch";

export async function POST(req: Request) {
  return handleAgentQuery("transit", data as unknown as DataFile, req);
}
