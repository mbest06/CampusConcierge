"use client";
// The whole web page: map + chat + "agent conversation" panel.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { AskResult } from "@/lib/types";

// The map only works in the browser, so it is loaded without server-side rendering.
const ResultMap = dynamic(() => import("./components/ResultMap"), {
  ssr: false,
  loading: () => <div className="mapLoading">Loading map…</div>,
});

type Msg = { id: number; role: "user" | "assistant"; text: string };

const HERO = "I have $10, I'm hungry, and class starts in 40 minutes. What can I eat, and which bus helps?";

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, role: "assistant", text: "Hi! Ask me about cheap food and Blacksburg Transit buses around campus." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  // Recent questions (only appear if MongoDB Atlas is set up).
  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setRecent(d.questions ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function add(role: Msg["role"], text: string) {
    setMessages((m) => [...m, { id: nextId.current++, role, text }]);
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setInput("");
    add("user", question);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as AskResult;
      if (!res.ok || data.error) throw new Error(data.error ?? `Server said ${res.status}`);
      setResult(data);
      add("assistant", data.answer || "Sorry, I couldn't put an answer together.");
    } catch (err) {
      add("assistant", `Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Hokie Concierge</h1>
        <p>One question, three agents: a main agent asks the Dining Scout and the Transit Guide for you.</p>
      </header>

      <main className="main">
        <section className="mapPane">
          <ResultMap pins={result?.pins ?? []} />
        </section>

        <section className="chatPane">
          {result?.isSample && (
            <div className="banner">Sample data: some results are still placeholders. Double-check before relying on them.</div>
          )}

          {result && (
            <div className="chips">
              {result.agents.map((a) => (
                <span key={a.id} className={`chip ${a.status}`}>
                  {a.name} · {a.status}
                  {a.answered === false ? " · no answer" : ""}
                </span>
              ))}
            </div>
          )}

          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="bubble assistant">Asking the agents…</div>}
            <div ref={endRef} />
          </div>

          {result && result.trace.length > 0 && (
            <details className="trace" open>
              <summary>Agent conversation</summary>
              <ul>
                {result.trace.map((t, i) => (
                  <li key={i} className={t.kind}>
                    <strong>
                      {t.from} → {t.to}
                    </strong>
                    : {t.text}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {messages.length === 1 && (
            <button className="example" onClick={() => ask(HERO)}>
              Try: “{HERO}”
            </button>
          )}

          {recent.length > 0 && (
            <div className="recent">
              <span>Recently asked:</span>
              {recent.map((q, i) => (
                <button key={i} onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className="inputRow"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about food or buses…"
              aria-label="Your question"
            />
            <button type="submit" disabled={loading}>
              Send
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
