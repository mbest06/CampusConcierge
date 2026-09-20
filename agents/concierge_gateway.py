"""Gateway API for the CampusConcierge web frontend.

Run from the agents folder after starting the individual agents:
    uvicorn concierge_gateway:app --port 8000 --reload
"""
import asyncio
import os
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

AGENT_URLS = {
    "dining": os.getenv("DINING_AGENT_URL", "http://127.0.0.1:8001"),
    "transit": os.getenv("TRANSIT_AGENT_URL", "http://127.0.0.1:8002"),
}

app = FastAPI(title="CampusConcierge Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConciergeRequest(BaseModel):
    message: str = ""
    latitude: float | None = None
    longitude: float | None = None


async def ask_agent(name: str, request: ConciergeRequest) -> dict[str, Any]:
    payload = {
        "intent": request.message,
        "params": {
            "question": request.message,
            "location": (
                {"lat": request.latitude, "lng": request.longitude}
                if request.latitude is not None and request.longitude is not None
                else None
            ),
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{AGENT_URLS[name]}/query", json=payload)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, OSError) as error:
        return {
            "agent": name,
            "results": [],
            "error": f"{name} agent unavailable: {error}",
            "dataAsOf": "",
            "isSample": True,
        }


@app.get("/health")
async def health():
    return {"ok": True, "agents": AGENT_URLS}


@app.post("/api/concierge")
async def concierge(request: ConciergeRequest):
    if not request.message.strip():
        return {"answer": "Please enter a question.", "agents": [], "results": []}

    responses = await asyncio.gather(
        *(ask_agent(name, request) for name in AGENT_URLS)
    )
    results = []
    agent_summaries = []

    for response in responses:
        agent = response.get("agent", "unknown")
        agent_summaries.append({
            "agent": agent,
            "error": response.get("error"),
            "dataAsOf": response.get("dataAsOf", ""),
            "isSample": response.get("isSample", True),
        })
        for item in response.get("results", []):
            results.append({
                **item,
                "agent": agent,
                "verified": False,
            })

    answer = (
        f"I checked {len([a for a in agent_summaries if not a['error']])} campus agents "
        f"and found {len(results)} results."
    )
    return {"answer": answer, "agents": agent_summaries, "results": results}
