// The shared brain of a SPECIALIST agent (dining and transit both use it).
// An agent receives a request from the main agent, searches its own data, and answers.
import type { AgentResponse, DataFile, DataItem } from "@/lib/types";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "are", "can", "what", "that", "this", "have", "has", "need",
  "want", "get", "was", "how", "who", "where", "when", "any", "some", "from", "about", "into",
  "near", "out", "not", "but", "its", "hungry", "class",
]);

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/**
 * Accepts our data format OR a plain array of rows, and common alternate field names
 * (name, description, hours, location, latitude, longitude, price, ...), so YOUR OWN JSON just works.
 */
export function normalizeData(raw: unknown): DataFile {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rows: unknown[] = Array.isArray(raw) ? raw : Array.isArray(obj.items) ? (obj.items as unknown[]) : [];
  const items: DataItem[] = rows
    .map((r) => {
      const i = (r ?? {}) as Record<string, unknown>;
      const tags = Array.isArray(i.tags)
        ? i.tags.map((t) => String(t))
        : typeof i.tags === "string"
          ? i.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
      return {
        title: str(i.title ?? i.name),
        detail: str(i.detail ?? i.description ?? i.summary),
        when: str(i.when ?? i.hours ?? i.schedule),
        where: str(i.where ?? i.location ?? i.address ?? i.stop),
        sourceUrl: str(i.sourceUrl ?? i.url ?? i.link),
        costUsd: num(i.costUsd ?? i.price ?? i.cost),
        tags,
        lat: num(i.lat ?? i.latitude),
        lng: num(i.lng ?? i.lon ?? i.long ?? i.longitude),
      };
    })
    .filter((i) => i.title !== "");
  return {
    dataAsOf: str(obj.dataAsOf) || "unknown",
    isSample: typeof obj.isSample === "boolean" ? obj.isSample : false,
    items,
  };
}

function tokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words.filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

function score(item: DataItem, wanted: Set<string>): number {
  const hay = tokens([item.title, item.detail, item.where, ...(item.tags ?? [])].join(" "));
  let n = 0;
  wanted.forEach((w) => {
    if (hay.has(w)) n += 1;
  });
  return n;
}

/**
 * Pick the best few rows for a request.
 * intent = short phrase from the main agent ("cheap lunch"), params may hold { budget, question }.
 */
export function searchData(
  data: DataFile,
  agentId: string,
  intent: string,
  params: Record<string, unknown> = {}
): AgentResponse {
  let items = data.items;

  // Budget filter (dollars). Rows without a price are kept.
  const budget = params.budget;
  if (typeof budget === "number") {
    items = items.filter((i) => i.costUsd === null || i.costUsd <= budget);
  }

  const wanted = new Set<string>([...tokens(intent), ...tokens(String(params.question ?? ""))]);
  const ranked = [...items].sort((a, b) => score(b, wanted) - score(a, wanted)).slice(0, 5);

  return {
    agent: agentId,
    results: ranked.map((i) => ({
      title: i.title,
      detail: i.detail,
      when: i.when,
      where: i.where,
      sourceUrl: i.sourceUrl,
      lat: i.lat,
      lng: i.lng,
    })),
    dataAsOf: data.dataAsOf,
    isSample: data.isSample,
  };
}

/** Turns an incoming Request into an answer. The route files just call this. */
export async function handleAgentQuery(agentId: string, rawData: unknown, req: Request): Promise<Response> {
  let body: { intent?: string; params?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { intent, params }" }, { status: 400 });
  }
  return Response.json(searchData(normalizeData(rawData), agentId, body.intent ?? "", body.params ?? {}));
}
