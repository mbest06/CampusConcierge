import asyncio
import os
from typing import List
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from crawl4ai import AsyncWebCrawler

# 1. Define your desired output schema
class CompanyAnalysis(BaseModel):
    company_name: str = Field(description="Name of the company or website")
    core_offering: str = Field(description="Primary product or service offered")
    key_features: List[str] = Field(description="3-5 key features or services found on the page")
    target_audience: str = Field(description="Intended audience for this platform")

# 2. Define the scraping tool
@tool
def scrape_website_content(url: str) -> str:
    "Scrapes a web page and returns clean markdown text content."
    async def _fetch():
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            return result.markdown[:4000]

    return asyncio.run(_fetch())

# 3. Setup Gemini model using gemini-3.6-flash
os.environ["GOOGLE_API_KEY"] = "AQ.Ab8RN6KH6lhUoFwu5aWfq0hsTnf7sNOsX8jekHnjJobv-0SPsA"

base_llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    http_options={"api_version": "v1"}
)

# LLM for tool decision
llm_with_tools = base_llm.bind_tools([scrape_website_content])

# LLM for structured output parsing
structured_llm = base_llm.with_structured_output(CompanyAnalysis)

# 4. Step 1: Ask the agent a question
query = "Can you read https://foodpro.students.vt.edu/menus/ and summarize what they offer?"
messages = [HumanMessage(content=query)]

# Model determines if it needs to scrape
response = llm_with_tools.invoke(messages)
messages.append(response)

# 5. Step 2: If the model chose to scrape, run the tool and format the final response
if response.tool_calls:
    tool_call = response.tool_calls[0]
    print(f"Executing Tool: {tool_call['name']}...")

    # Execute the scraping tool
    scraped_data = scrape_website_content.invoke(tool_call['args'])

    # Append tool output to context history
    messages.append(ToolMessage(content=scraped_data, tool_call_id=tool_call['id']))

    # Pass the full context to the structured model
    final_output: CompanyAnalysis = structured_llm.invoke(messages)

    # 6. Access structured output directly as a Pydantic object or JSON
    print("\n--- Parsed Pydantic Object ---")
    print(f"Company: {final_output.company_name}")
    print(f"Offering: {final_output.core_offering}")

    print("\n--- Raw JSON Dump ---")
    print(final_output.model_dump_json(indent=2))