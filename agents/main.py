"""Shared FastAPI server for the CampusConcierge specialist agents."""
import json
import math
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI
from pydantic import BaseModel, Field

AGENT_ID = os.environ.get("AGENT_ID", "dining")
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
TRANSIT_URL = "https://ridebt.org/schedules"

# Define your standalone scraper script filenames here 
SCRAPER_FILES = {
    "dining": "dining_scraper.py",    
    "transit": "transit_scraper.py"   
}

CARDS = {
    "dining": {
        "id": "dining",
        "name": "Dining Scout",
        "description": "Finds campus dining options.",
        "capabilities": ["food", "dining", "coffee"],
    },
    "transit": {
        "id": "transit",
        "name": "Transit Guide",
        "description": "Finds bus routes and schedules.",
        "capabilities": ["routes", "bus", "transit"],
    },
}

STOPWORDS = {
    "the", "and", "for", "with", "you", "are", "can", "what", "that", "this",
    "have", "has", "need", "want", "get", "was", "how", "who", "where", "when",
    "any", "some", "from", "about", "into", "near", "out", "not", "but", "its",
    "find", "me", "please", "after", "classes", "class",
}

app = FastAPI(title=f"CampusConcierge agent: {AGENT_ID}")


class Query(BaseModel):
    intent: str = ""
    params: dict[str, Any] = Field(default_factory=dict)


def load_local_data(agent_id: str = AGENT_ID) -> dict:
    """Load an agent's local JSON fallback dataset."""
    path = DATA_DIR / f"{agent_id}.json"
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def scrape_live_transit() -> dict:
    """Load route listings from the official Blacksburg Transit schedules page."""
    response = requests.get(
        TRANSIT_URL,
        timeout=8,
        headers={"User-Agent": "CampusConcierge/1.0"},
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    items: list[dict[str, Any]] = []
    seen_codes: set[str] = set()

    candidates = soup.find_all(["strong", "h1", "h2", "h3", "h4", "a"])
    for element in candidates:
        text = " ".join(element.get_text(" ", strip=True).split())
        match = re.match(r"^([A-Z0-9]{2,5})\s*[-–—:]\s*(.+)$", text)
        if not match:
            continue

        route_code = match.group(1).upper()
        route_name = match.group(2).strip()
        if route_code in seen_codes:
            continue

        route_words = f"{route_code} {route_name}".lower()
        if not any(word in route_words for word in ("bus", "shuttle", "route", "loop", "transit")):
            continue

        seen_codes.add(route_code)
        items.append({
            "title": f"{route_code} - {route_name}",
            "detail": f"Blacksburg Transit route {route_code}: {route_name}.",
            "when": "Check the official schedules page for current service times and alerts.",
            "where": "Blacksburg, Virginia",
            "sourceUrl": TRANSIT_URL,
            "tags": [route_code.lower(), "bus", "transit", "route"],
            "lat": 37.2286,
            "lng": -80.4234,
        })

    if not items:
        raise RuntimeError("No transit routes were found in the page HTML")

    return {
        "items": items,
        "dataAsOf": datetime.now(timezone.utc).isoformat(),
        "isSample": False,
    }


def load_data() -> dict:
    """Invokes your external scraper scripts to refresh data folders dynamically before serving requests."""
    scraper_script = SCRAPER_FILES.get(AGENT_ID)
    
    if scraper_script:
        scraper_path = Path(__file__).resolve().parent / scraper_script
        if scraper_path.exists():
            try:
                print(f"[{AGENT_ID.upper()}] Triggering backend scraper file execution: {scraper_script}...")
                # Run the external script synchronously, timing out after 10 seconds to protect network channels
                subprocess.run([sys.executable, str(scraper_path)], timeout=10, check=True)
                print(f"[{AGENT_ID.upper()}] Cloud directory records successfully refreshed.")
            except subprocess.TimeoutExpired:
                print(f"WARNING: Scraper file {scraper_script} timed out. Reading from system cache instead.")
            except Exception as error:
                print(f"WARNING: Scraper runtime call execution encountered an issue: {error}.")
        else:
            print(f"LOG: Scraper script '{scraper_script}' not found. Serving from direct JSON local records instead.")

    # Always pull the fresh dataset directly from the local target JSON file 
    if AGENT_ID == "transit":
        try:
            return load_local_data("transit")
        except Exception:
            # Fall back directly onto the page scraper routine if the target file is missing
            try:
                return scrape_live_transit()
            except (requests.RequestException, RuntimeError, OSError) as error:
                print(f"Live backup transit loading failed; using base fallback configuration: {error}")
                
    return load_local_data()


def tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) > 2 and token not in STOPWORDS
    }


def score(item: dict, wanted: set[str]) -> int:
    haystack = " ".join([
        str(item.get("title", "")),
        str(item.get("detail", "")),
        " ".join(map(str, item.get("tags", []))),
    ])
    return len(tokens(haystack) & wanted)


def distance_km(loc: Any, item: dict) -> float:
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
    wanted = tokens(q.intent) | tokens(str(q.params.get("question", "")))

    relevant = [
        (score(item, wanted), item)
        for item in items
        if score(item, wanted) > 0
    ]

    if not relevant:
        return {
            "agent": AGENT_ID,
            "results": [],
            "dataAsOf": data.get("dataAsOf", ""),
            "isSample": data.get("isSample", True),
        }

    location = q.params.get("location")
    relevant.sort(key=lambda pair: (-pair[0], distance_km(location, pair[1])))

    results = []
    for _, item in relevant[:5]:
        item_distance = distance_km(location, item) if location else 1e9
        results.append({
            **{
                key: item.get(key, "")
                for key in ("title", "detail", "when", "where", "sourceUrl")
            },
            "lat": item.get("lat"),
            "lng": item.get("lng"),
            "distanceKm": round(item_distance, 2) if item_distance < 1e8 else None,
        })

    return {
        "agent": AGENT_ID,
        "results": results,
        "dataAsOf": data.get("dataAsOf", ""),
        "isSample": data.get("isSample", True),
    }