"""Hokie Concierge agent template.

Run ONE COPY PER AGENT, choosing the agent with the AGENT_ID environment variable:
    AGENT_ID=dining uvicorn main:app --port 8001

Or start all four at once:  python run_all.py

Each agent reads ../data/<AGENT_ID>.json and answers the shared contract:
    GET  /health       -> {"ok": true}
    GET  /agent-card   -> name, description, capabilities
    POST /query        -> {"intent": "...", "params": {...}} -> {"agent", "results", "dataAsOf", "isSample"}
                          (each result: title, detail, when, where, sourceUrl, lat, lng, distanceKm)
"""
import json
import math
import os
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

AGENT_ID = os.environ.get("AGENT_ID", "dining")
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))

CARDS = {
    "dining": {
        "id": "dining",
        "name": "Dining Scout",
        "description": "Finds campus dining options by budget, time of day, and hours.",
        "capabilities": ["cheap_food_now", "dining_hours"],
    },
    "transit": {
        "id": "transit",
        "name": "Transit Guide",
        "description": "Finds bus routes and schedules around campus and town.",
        "capabilities": ["routes", "next_bus"],
    },
}

STOPWORDS = {
    "the", "and", "for", "with", "you", "are", "can", "what", "that", "this",
    "have", "has", "need", "want", "get", "was", "how", "who", "where", "when",
    "any", "some", "from", "about", "into", "near", "out", "not", "but", "its",
}

app = FastAPI(title=f"Hokie Concierge agent: {AGENT_ID}")


class Query(BaseModel):
    intent: str = ""
    params: dict[str, Any] = Field(default_factory=dict)


def load_data() -> dict:
    """Re-read the JSON on every request so teammates can edit data without restarting."""
    path = DATA_DIR / f"{AGENT_ID}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def tokens(text: str) -> set:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2 and t not in STOPWORDS}


def score(item: dict, wanted: set) -> int:
    haystack = " ".join(
        [item.get("title", ""), item.get("detail", ""), " ".join(item.get("tags", []))]
    )
    return len(tokens(haystack) & wanted)


def distance_km(loc, item: dict) -> float:
    """Straight-line distance from the student to an item. Unknown -> huge number, so it sorts last."""
    try:
        lat1, lng1 = float(loc["lat"]), float(loc["lng"])
        lat2, lng2 = float(item["lat"]), float(item["lng"])
    except (TypeError, KeyError, ValueError):
        return 1e9
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dlam = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


@app.get("/health")
def health():
    return {"ok": True, "agent": AGENT_ID}


@app.get("/agent-card")
def agent_card():
    return CARDS.get(AGENT_ID, {"id": AGENT_ID})


@app.post("/query")
def query(q: Query):
    data = load_data()
    items = data.get("items", [])

    # Optional budget filter (dollars). Items without a cost are kept.
    budget = q.params.get("budget")
    if isinstance(budget, (int, float)):
        items = [i for i in items if i.get("costUsd") is None or i["costUsd"] <= budget]

    wanted = tokens(q.intent) | tokens(str(q.params.get("question", "")))
    # Best text match first; if the client sent its location, nearer items win ties.
    loc = q.params.get("location")
    ranked = sorted(items, key=lambda i: (-score(i, wanted), distance_km(loc, i)))[:5]

    # lat/lng are optional numbers (or null). The mobile app puts a map marker on any result that has them.
    results = [
        {
            **{k: i.get(k, "") for k in ("title", "detail", "when", "where", "sourceUrl")},
            "lat": i.get("lat"),
            "lng": i.get("lng"),
            # Only present when the client sent its location; otherwise null.
            "distanceKm": round(distance_km(loc, i), 2) if loc and distance_km(loc, i) < 1e8 else None,
        }
        for i in ranked
    ]
    return {
        "agent": AGENT_ID,
        "results": results,
        "dataAsOf": data.get("dataAsOf", ""),
        "isSample": data.get("isSample", True),
    }
