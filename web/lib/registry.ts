// The list of agents the concierge can use, plus the identity check.
//
// Person C: replace the body of verifyAgent() with a REAL ANS check once an agent is registered.
// Until then it returns status "mock". The UI must show "mock" honestly (never a green "verified"
// badge for a mock result) - judges will ask.

export type AnsStatus = "verified" | "unverified" | "mock";

export type AgentRecord = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  endpoint: string; // base URL of the agent's FastAPI service
  domain: string; // the agent's subdomain, e.g. dining.yourdomain.xyz
};

export type VerifyResult = {
  agentId: string;
  status: AnsStatus;
  publisher: string;
  checkedAt: string;
};

const YOUR_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "yourdomain.xyz"; // TODO: set to your GoDaddy domain

// Locally each agent runs on its own port. On Vultr, set AGENT_URL_DINING etc. to the real URLs.
function endpointFor(id: string, port: number): string {
  return process.env[`AGENT_URL_${id.toUpperCase()}`] ?? `http://127.0.0.1:${port}`;
}

export const AGENTS: AgentRecord[] = [
  {
    id: "dining",
    name: "Dining Scout",
    description: "Finds campus dining options by budget, time of day, and hours.",
    capabilities: ["cheap_food_now", "dining_hours"],
    endpoint: endpointFor("dining", 8001),
    domain: `dining.${YOUR_DOMAIN}`,
  },
  {
    id: "transit",
    name: "Transit Guide",
    description: "Finds bus routes and schedules around campus and town.",
    capabilities: ["routes", "next_bus"],
    endpoint: endpointFor("transit", 8002),
    domain: `transit.${YOUR_DOMAIN}`,
  },
];

export function getAgent(id: string): AgentRecord | undefined {
  return AGENTS.find((a) => a.id === id);
}

// MOCK implementation. Same shape the real one will return, so nothing else has to change.
export async function verifyAgent(agent: AgentRecord): Promise<VerifyResult> {
  // TODO(Person C): call the real ANS verification for agent.domain and map the result:
  //   verified   -> status "verified", publisher from the certificate/registry
  //   failed     -> status "unverified"
  return {
    agentId: agent.id,
    status: "mock",
    publisher: "Hokie Concierge team (MOCK - not ANS)",
    checkedAt: new Date().toISOString(),
  };
}
