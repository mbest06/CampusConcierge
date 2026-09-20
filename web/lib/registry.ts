// The list of agents the MAIN agent can talk to, plus the identity check.
//
// verifyAgent() is a MOCK. It returns "mock" and the page shows it in gray, honestly.
// If a GoDaddy ANS mentor gives you a quick way to do a real check, replace the body below.
import diningRaw from "@/data/dining.json";
import transitRaw from "@/data/transit.json";
import { normalizeData } from "@/lib/agentRuntime";
import type { DataFile } from "@/lib/types";

export type AgentInfo = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  path: string; // where the agent lives inside this app (the main agent calls it over HTTP)
  data: DataFile; // the agent's own data (also used as a safety net if the HTTP call fails)
};

export const AGENTS: AgentInfo[] = [
  {
    id: "dining",
    name: "Dining Scout",
    description: "Finds campus dining options by budget, time of day, and hours.",
    capabilities: ["cheap_food_now", "dining_hours"],
    path: "/api/agents/dining",
    data: normalizeData(diningRaw),
  },
  {
    id: "transit",
    name: "Transit Guide",
    description: "Finds bus stops and routes around campus and town.",
    capabilities: ["routes", "stops"],
    path: "/api/agents/transit",
    data: normalizeData(transitRaw),
  },
];

export function getAgent(id: string): AgentInfo | undefined {
  return AGENTS.find((a) => a.id === id);
}

export async function verifyAgent(
  agent: AgentInfo
): Promise<{ status: "verified" | "unverified" | "mock"; note: string }> {
  // TODO (only if you get a real ANS check working): call it here and return "verified" / "unverified".
  return { status: "mock", note: `identity check for ${agent.name} is a MOCK (not real ANS)` };
}
