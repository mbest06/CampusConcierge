// Shared shapes used by the server (lib/, app/api/) and the page (app/page.tsx).

/** One row of campus data (a dining spot or a bus stop). Lives in data/*.json */
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

export type DataFile = {
  dataAsOf: string;
  isSample: boolean; // keep true until EVERY row is real, sourced data
  items: DataItem[];
};

/** What a specialist agent (dining / transit) sends back to the main agent. */
export type AgentResponse = {
  agent: string;
  results: {
    title: string;
    detail: string;
    when: string;
    where: string;
    sourceUrl: string;
    lat: number | null;
    lng: number | null;
  }[];
  dataAsOf: string;
  isSample: boolean;
};

// ---- What the main agent sends to the web page (POST /api/ask) ----

export type AgentStatus = {
  id: string;
  name: string;
  status: "verified" | "unverified" | "mock"; // "mock" = NOT really verified. Show it honestly.
  publisher: string; // who vouches for the agent (for the mock: says so plainly)
  answered: boolean | null; // null = agent was not called
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
  distanceKm: number | null; // reserved (null in this version)
};

/** One message in the visible "agent conversation" (this is what shows the agents talking). */
export type TraceStep = {
  from: string;
  to: string;
  kind: "plan" | "verify" | "request" | "response" | "error";
  text: string;
};

export type AskResult = {
  answer: string;
  usedAgents: string[];
  agents: AgentStatus[];
  pins: Pin[];
  trace: TraceStep[];
  isSample: boolean; // true = some data is still placeholder -> show a banner
  error: string | null;
};
