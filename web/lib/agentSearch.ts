// The dining and transit agents, rewritten in TypeScript so they run INSIDE the Next.js app
// (Vercel can't run your Python agents). Same contract as the Python agents:
//   POST { intent, params }  ->  { agent, results[], dataAsOf, isSample }
// Each agent reads its own file in web/data/. Only the ROUTE files differ per agent.

export type DataItem = {
  title: string;
  detail: string;
  when: string;
  where: string;
  sourceUrl: string;
  costUsd: number | null;
  tags: string[];
  lat: number | null;
  lng: number | null;
};

export type DataFile = { dataAsOf: string; isSample: boolean; items: DataItem[] };

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "are", "can", "what", "that", "this", "have", "has", "need",
  "want", "get", "was", "how", "who", "where", "when", "any", "some", "from", "about", "into",
  "near", "out", "not", "but", "its",
]);

function tokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words.filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

function score(item: DataItem, wanted: Set<string>): number {
  const hay = tokens([item.title, item.detail, ...(item.tags ?? [])].join(" "));
  let n = 0;
  wanted.forEach((w) => {
    if (hay.has(w)) n += 1;
  });
  return n;
}

type Loc = { lat: number; lng: number };

function readLocation(value: unknown): Loc | null {
  const v = value as { lat?: unknown; lng?: unknown } | null | undefined;
  return v && typeof v.lat === "number" && typeof v.lng === "number" ? { lat: v.lat, lng: v.lng } : null;
}

/** Straight-line distance in km, or null when the item has no coordinates. */
function distanceKm(loc: Loc, item: DataItem): number | null {
  if (typeof item.lat !== "number" || typeof item.lng !== "number") return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dPhi = rad(item.lat - loc.lat);
  const dLam = rad(item.lng - loc.lng);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(rad(loc.lat)) * Math.cos(rad(item.lat)) * Math.sin(dLam / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function searchData(data: DataFile, agentId: string, intent: string, params: Record<string, unknown> = {}) {
  let items = data.items;

  // Budget filter (dollars). Rows without a price are kept.
  if (typeof params.budget === "number") {
    const budget = params.budget;
    items = items.filter((i) => i.costUsd === null || i.costUsd <= budget);
  }

  const wanted = new Set<string>([...tokens(intent), ...tokens(String(params.question ?? ""))]);
  const loc = readLocation(params.location);

  // Best text match first; if the client sent its location, nearer rows win ties.
  const ranked = items
    .map((item) => ({ item, s: score(item, wanted), d: loc ? distanceKm(loc, item) : null }))
    .sort((a, b) => b.s - a.s || (a.d ?? 1e9) - (b.d ?? 1e9))
    .slice(0, 5);

  return {
    agent: agentId,
    results: ranked.map(({ item, d }) => ({
      title: item.title,
      detail: item.detail,
      when: item.when,
      where: item.where,
      sourceUrl: item.sourceUrl,
      lat: item.lat,
      lng: item.lng,
      distanceKm: d === null ? null : Math.round(d * 100) / 100,
    })),
    dataAsOf: data.dataAsOf,
    isSample: data.isSample,
  };
}

/** Turns an incoming Request into an answer. The route files just call this. */
export async function handleAgentQuery(agentId: string, data: DataFile, req: Request): Promise<Response> {
  let body: { intent?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { intent, params }" }, { status: 400 });
  }
  return Response.json(searchData(data, agentId, body.intent ?? "", body.params ?? {}));
}
