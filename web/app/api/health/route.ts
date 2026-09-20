// Open /api/health to check the server is up and each agent loaded its data.
import { AGENTS } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY),
    atlasConfigured: Boolean(process.env.MONGODB_URI),
    agents: AGENTS.map((a) => ({ id: a.id, name: a.name, rows: a.data.items.length, isSample: a.data.isSample })),
  });
}
