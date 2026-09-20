// Turns the concierge's event list into ONE flat object that any client can read without
// understanding the event stream. This is the response shape of POST /api/v1/ask (see API.md).

export type ConciergeEvent = { event: string; data: any };

export type AgentStatus = {
  id: string;
  status: "verified" | "unverified" | "mock"; // "mock" = NOT really verified; show it honestly
  publisher: string;
  answered: boolean | null; // null = agent was not called (e.g. failed verification)
  error: string | null;
};

export type Pin = {
  id: string;
  agent: string;
  title: string;
  detail: string;
  when: string;
  where: string;
  sourceUrl: string;
  lat: number;
  lng: number;
  distanceKm: number | null; // only set when the client sent its location
};

export type AskResult = {
  answer: string;
  usedAgents: string[];
  agents: AgentStatus[];
  pins: Pin[];
  isSample: boolean; // true if ANY agent used placeholder/sample data - show a banner
  error: string | null;
};

export function summarizeEvents(events: ConciergeEvent[]): AskResult {
  const agents: AgentStatus[] = [];
  const pins: Pin[] = [];
  let answer = "";
  let usedAgents: string[] = [];
  let error: string | null = null;
  let isSample = false;

  for (const { event, data } of events) {
    if (event === "verify") {
      agents.push({
        id: data.agentId,
        status: data.status,
        publisher: data.publisher ?? "",
        answered: null,
        error: null,
      });
    } else if (event === "agent_result") {
      const a = agents.find((x) => x.id === data.agent);
      if (a) {
        a.answered = !!data.ok;
        a.error = data.ok ? null : String(data.error ?? "failed");
      }
      if (data.ok) {
        if (data.data?.isSample) isSample = true;
        (data.data?.results ?? []).forEach((r: any, i: number) => {
          if (typeof r.lat === "number" && typeof r.lng === "number") {
            pins.push({
              id: `${data.agent}-${i}`,
              agent: data.agent,
              title: r.title ?? "",
              detail: r.detail ?? "",
              when: r.when ?? "",
              where: r.where ?? "",
              sourceUrl: r.sourceUrl ?? "",
              lat: r.lat,
              lng: r.lng,
              distanceKm: typeof r.distanceKm === "number" ? r.distanceKm : null,
            });
          }
        });
      }
    } else if (event === "final") {
      answer = data.answer ?? "";
      usedAgents = data.usedAgents ?? [];
    } else if (event === "error") {
      error = data.message ?? "Unknown error";
    }
  }

  return { answer, usedAgents, agents, pins, isSample, error };
}
