import asyncio
import os
import json
from typing import List
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from crawl4ai import AsyncWebCrawler

# Target Transit URL (Blacksburg Transit / VT Bus routes)
TARGET_URL = "https://ridebt.org/routes-schedules"

# 1. Output Schema for Bus Transit Agent Inter-Agent Consumption
class AgentBusRouteResponse(BaseModel):
    query: str = Field(description="The original routing query passed in by the requesting agent.")
    direct_answer: str = Field(description="A concise response answering the origin-to-destination query.")
    optimal_route: str = Field(description="Step-by-step description of the recommended route and transfers.")
    bus_lines: List[str] = Field(description="List of relevant bus routes or line names involved (e.g., 'Hokie Express', 'Tom's Creek').")
    schedule_notes: str = Field(description="Operating hours, departure frequencies, or service warnings.")

# 2. Define scraping tool for transit info
@tool
def scrape_bus_routes(url: str = TARGET_URL) -> str:
    "Scrapes Blacksburg Transit bus routes and returns clean markdown text content."
    async def _fetch():
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=TARGET_URL)
            return result.markdown[:4000]

    return asyncio.run(_fetch())

# 3. Setup Groq Model (requires: pip install langchain-groq)
os.environ["GROQ_API_KEY"] = "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"

base_llm = ChatGroq(
    model="llama-prompt-guard-2-86m",
    temperature=0
)

llm_with_tools = base_llm.bind_tools([scrape_bus_routes])
structured_llm = base_llm.with_structured_output(AgentBusRouteResponse)

# 4. Agent Function Wrapper
def process_bus_agent_query(incoming_query: str) -> dict:
    """
    Receives a transit query from another agent, scrapes current bus schedule data,
    and returns optimal routing information structured for downstream AI ingestion.
    """
    prompt = (
        f"The user/agent is asking for transit routing: '{incoming_query}'. "
        f"You must scrape {TARGET_URL} to find current available bus routes and schedule data, "
        f"then calculate the optimal transit path."
    )
    
    messages = [HumanMessage(content=prompt)]

    # Step 1: Tool execution determination
    response = llm_with_tools.invoke(messages)
    messages.append(response)

    # Step 2: Tool execution & Context gathering
    if response.tool_calls:
        tool_call = response.tool_calls[0]

        # Execute scrape strictly for TARGET_URL
        scraped_data = scrape_bus_routes.invoke({"url": TARGET_URL})
        messages.append(ToolMessage(content=scraped_data, tool_call_id=tool_call['id']))

        # Step 3: Parse output into the structured inter-agent transit schema
        final_output: AgentBusRouteResponse = structured_llm.invoke(messages)

        return final_output.model_dump()

    return {
        "query": incoming_query,
        "direct_answer": "Failed to invoke transit scraping tool for context.",
        "optimal_route": "",
        "bus_lines": [],
        "schedule_notes": ""
    }