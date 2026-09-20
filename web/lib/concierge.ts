// THE MAIN AGENT. It never answers from its own knowledge. It:
//   1. PLANS   - asks Gemini which specialist agents are needed
//   2. VERIFIES - checks each agent's identity (mock unless you build a real ANS check)
//   3. ASKS    - sends each specialist a request over HTTP (agent-to-agent communication)
//   4. ANSWERS - asks Gemini to write one reply using ONLY what the specialists returned
// Every step is written to `trace` so the page can SHOW the agents talking to each other.
import { AGENTS, getAgent, verifyAgent } from "@/lib/registry";
import { askGeminiJSON, askGeminiText } from "@/lib/gemini";
import { searchData } from "@/lib/agentRuntime";
import type { AgentResponse, AgentStatus, AskResult, Pin, TraceStep } from "@/lib/types";

type PlannedCall = { agent: string; intent: string; params?: Record<string, unknown> };
type Plan = { calls: PlannedCall[] };

// If an agent's HTTP call is slower than this (or fails), the main agent falls back to asking the
// agent's data directly, so the demo never dies. The trace says so plainly when that happens.
const AGENT_TIMEOUT_MS = 4000;

export async function runConcierge(question: string, origin: string): Promise<AskResult> {
  const trace: TraceStep[] = [];
  const agents: AgentStatus[] = [];
  const pins: Pin[] = [];
  let isSample = false;

  try {
    // ---- 1. PLAN -----------------------------------------------------------
    const catalog = AGENTS.map((a) => ({ id: a.id, description: a.description, capabilities: a.capabilities }));
    const planPrompt = `You route student questions for a Virginia Tech campus assistant.
Available agents (JSON): ${JSON.stringify(catalog)}
Student question: "${question}"

Reply ONLY with JSON in this exact shape:
{"calls":[{"agent":"<agent id>","intent":"<short phrase describing what to look up>","params":{"budget":<number or omit>}}]}
Choose 1 or 2 agents (use both when the question needs food AND a bus). Use only agent ids from the list.
If no agent fits, reply {"calls":[]}.`;

    const plan = await askGeminiJSON<Plan>(planPrompt);
    const calls = (plan.calls ?? []).filter((c) => getAgent(c.agent)).slice(0, 2);
    trace.push({
      from: "main",
      to: "main",
      kind: "plan",
      text: calls.length
        ? `Plan: ask ${calls.map((c) => c.agent).join(" and ")}`
        : "Plan: no specialist agent fits this question",
    });

    // ---- 2. VERIFY ---------------------------------------------------------
    const toCall: PlannedCall[] = [];
    for (const call of calls) {
      const info = getAgent(call.agent)!;
      const check = await verifyAgent(info);
      agents.push({
        id: info.id,
        name: info.name,
        status: check.status,
        publisher: check.note,
        answered: null,
        error: null,
      });
      trace.push({ from: "main", to: info.id, kind: "verify", text: check.note });
      if (check.status !== "unverified") toCall.push(call);
    }

    // ---- 3. ASK the specialists (in parallel) ------------------------------
    const replies = await Promise.all(
      toCall.map(async (call) => {
        const info = getAgent(call.agent)!;
        const status = agents.find((a) => a.id === info.id)!;
        trace.push({ from: "main", to: info.id, kind: "request", text: call.intent });
        const params = { ...(call.params ?? {}), question };

        let data: AgentResponse;
        let note = "";
        try {
          // The real thing: an HTTP request from the main agent to the specialist agent.
          const res = await fetch(`${origin}${info.path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ intent: call.intent, params }),
            signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = (await res.json()) as AgentResponse;
        } catch (httpErr) {
          // Safety net: ask the agent's own data directly, and SAY SO in the trace.
          try {
            data = searchData(info.data, info.id, call.intent, params);
            note = ` (answered locally: HTTP call failed - ${String(httpErr).slice(0, 60)})`;
          } catch (localErr) {
            status.answered = false;
            status.error = String(localErr);
            trace.push({ from: info.id, to: "main", kind: "error", text: `no answer (${String(localErr)})` });
            return null;
          }
        }
        status.answered = true;
        trace.push({ from: info.id, to: "main", kind: "response", text: `${data.results.length} result(s)${note}` });
        return data;
      })
    );
    const good = replies.filter((r): r is AgentResponse => r !== null);

    // Collect map pins and the sample-data flag.
    for (const r of good) {
      if (r.isSample) isSample = true;
      r.results.forEach((item, i) => {
        if (typeof item.lat === "number" && typeof item.lng === "number") {
          pins.push({
            id: `${r.agent}-${i}`,
            agent: r.agent,
            title: item.title,
            detail: item.detail,
            when: item.when,
            where: item.where,
            sourceUrl: item.sourceUrl,
            lat: item.lat,
            lng: item.lng,
            distanceKm: null,
          });
        }
      });
    }

    // ---- 4. ANSWER ---------------------------------------------------------
    const answerPrompt = `You are Hokie Concierge, a friendly assistant for Virginia Tech students.
Student question: "${question}"

Data returned by your specialist agents (JSON): ${JSON.stringify(good)}

Rules:
- Use ONLY the data above. Never invent hours, prices, places, or events.
- Include times and locations when the data has them.
- If any result has "isSample": true, say the info is sample data and should be double-checked.
- When both a dining result and a transit result are present, connect them: what to eat, where it is, and which bus/stop helps.
- If the data does not answer the question, say you don't know and suggest checking official Virginia Tech sources.
- Keep it short, warm, and easy to scan (a few short lines, no long paragraphs).`;

    const answer = await askGeminiText(answerPrompt);
    return {
      answer,
      usedAgents: good.map((g) => g.agent),
      agents,
      pins,
      trace,
      isSample,
      error: null,
    };
  } catch (err) {
    return {
      answer: "",
      usedAgents: [],
      agents,
      pins,
      trace,
      isSample,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
