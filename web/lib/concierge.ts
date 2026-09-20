// The concierge brain, extracted so BOTH routes can use it:
//   /api/concierge       -> streams events (Server-Sent Events)
//   /api/concierge-json  -> returns all events at once (easiest for the mobile app)
//
// Events emitted, in order:
//   plan          which agents Gemini chose
//   verify        one per chosen agent: identity check result (status: verified | unverified | mock)
//   agent_result  one per agent that answered (or failed / timed out); data.results[] may include lat/lng
//   final         the written answer + which agents were used
//   error         something broke (message included)
//
// Person A: this file is yours. Tune the two prompts and test with realistic questions.
import { AGENTS, getAgent, verifyAgent } from "@/lib/registry";
import { askGeminiJSON, askGeminiText } from "@/lib/gemini";

export type Emit = (event: string, data: unknown) => void;

type PlannedCall = { agent: string; intent: string; params?: Record<string, unknown> };
type Plan = { calls: PlannedCall[] };

const AGENT_TIMEOUT_MS = 3000;

export type ConciergeOptions = { location?: { lat: number; lng: number } };

export async function runConcierge(
  question: string,
  send: Emit,
  opts: ConciergeOptions = {}
): Promise<void> {
  try {
    // 1) PLAN: ask Gemini which agents to use.
    const catalog = AGENTS.map((a) => ({
      id: a.id,
      description: a.description,
      capabilities: a.capabilities,
    }));
    const planPrompt = `You route student questions for a Virginia Tech campus assistant.
Available agents (JSON): ${JSON.stringify(catalog)}
Student question: "${question}"

Reply ONLY with JSON in this exact shape:
{"calls":[{"agent":"<agent id>","intent":"<short phrase describing what to look up>","params":{"budget":<number or omit>,"minutes":<number or omit>}}]}
Choose 1 or 2 agents (use both when the question needs food AND a bus). Use only agent ids from the list. If no agent fits, reply {"calls":[]}.`;

    const plan = await askGeminiJSON<Plan>(planPrompt);
    const calls = (plan.calls ?? []).filter((c) => getAgent(c.agent)).slice(0, 2);
    send("plan", { calls });

    // 2) VERIFY: check each chosen agent's identity before calling it.
    const verified: PlannedCall[] = [];
    for (const call of calls) {
      const agent = getAgent(call.agent)!;
      const result = await verifyAgent(agent);
      send("verify", result);
      if (result.status !== "unverified") verified.push(call);
    }

    // 3) CALL the verified agents in parallel, each with a short timeout.
    const results = await Promise.all(
      verified.map(async (call) => {
        const agent = getAgent(call.agent)!;
        try {
          const res = await fetch(`${agent.endpoint}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: call.intent,
              params: { ...(call.params ?? {}), question, ...(opts.location ? { location: opts.location } : {}) },
            }),
            signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          send("agent_result", { agent: agent.id, ok: true, data });
          return { agent: agent.id, data };
        } catch (err) {
          send("agent_result", { agent: agent.id, ok: false, error: String(err) });
          return null;
        }
      })
    );
    const good = results.filter(Boolean);

    // 4) ANSWER: Gemini writes the reply using ONLY what the agents returned.
    const locationNote = opts.location
      ? "- The student shared their location, so results are ordered nearest first when they have coordinates.\n"
      : "";
    const answerPrompt = `You are Hokie Concierge, a friendly assistant for Virginia Tech students, shown inside a phone app with a map.
Student question: "${question}"

Data returned by campus agents (JSON): ${JSON.stringify(good)}

Rules:
- Use ONLY the data above. Never invent hours, prices, places, or events.
- Include times and locations when the data has them.
${locationNote}- If any result has "isSample": true, say the info is sample data and should be double-checked.
- If the data does not answer the question, say you don't know and suggest checking official Virginia Tech sources.
- When both a dining result and a transit result are present, connect them: say what to eat, where it is, and which bus/stop helps.
- Keep it short, warm, and easy to read on a phone (a few short lines, no long paragraphs).`;

    const answer = await askGeminiText(answerPrompt);
    send("final", { answer, usedAgents: good.map((g) => g!.agent) });
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
  }
}
