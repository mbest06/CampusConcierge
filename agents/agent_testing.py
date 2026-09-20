import asyncio
import os
import json
from typing import List
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from crawl4ai import AsyncWebCrawler

# Enforce the target URL across all runs
TARGET_URL = "https://foodpro.students.vt.edu/menus/"

# 1. Output Schema designed for Inter-Agent Consumption
class AgentMenuResponse(BaseModel):
    query: str = Field(description="The original question passed in by the requesting agent.")
    direct_answer: str = Field(description="A concise answer addressing the calling agent's query.")
    extracted_items: List[str] = Field(description="List of relevant items, menu options, or restaurants extracted.")
    context_summary: str = Field(description="A brief summary of what was found on the scraped page.")

# 2. Define the scraping tool (bound to TARGET_URL)
@tool
def scrape_website_content(url: str = TARGET_URL) -> str:
    "Scrapes the VT FoodPro menu web page and returns clean markdown text content."
    async def _fetch():
        async with AsyncWebCrawler() as crawler:
            # Force target URL regardless of incoming arguments
            result = await crawler.arun(url=TARGET_URL)
            return result.markdown[:4000]

    return asyncio.run(_fetch())

# 3. Setup Gemini Model
os.environ["GOOGLE_API_KEY"] = "AQ.Ab8RN6KH6lhUoFwu5aWfq0hsTnf7sNOsX8jekHnjJobv-0SPsA"

base_llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    http_options={"api_version": "v1"}
)

llm_with_tools = base_llm.bind_tools([scrape_website_content])
structured_llm = base_llm.with_structured_output(AgentMenuResponse)

# 4. Agent Function Wrapper
def process_agent_query(incoming_query: str) -> dict:
    """
    Receives a query string from another agent, scrapes the target menu site,
    and returns a structured dictionary for the caller to ingest directly.
    """
    prompt = (
        f"The user/agent is asking: '{incoming_query}'. "
        f"You must scrape {TARGET_URL} to find the accurate answer."
    )
    
    messages = [HumanMessage(content=prompt)]

    # Step 1: Tool execution determination
    response = llm_with_tools.invoke(messages)
    messages.append(response)

    # Step 2: Tool execution & Context gathering
    if response.tool_calls:
        tool_call = response.tool_calls[0]

        # Execute scrape strictly for TARGET_URL
        scraped_data = scrape_website_content.invoke({"url": TARGET_URL})
        messages.append(ToolMessage(content=scraped_data, tool_call_id=tool_call['id']))

        # Step 3: Parse output into the structured inter-agent format
        final_output: AgentMenuResponse = structured_llm.invoke(messages)

        # Return as a native Python dict (or JSON string) for downstream agents
        return final_output.model_dump()

    return {
        "query": incoming_query,
        "direct_answer": "Failed to invoke scraping tool for context.",
        "extracted_items": [],
        "context_summary": ""
    }