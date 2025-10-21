"""
MCP server for web search and fetch capabilities.

Tools:
- search: Web search via DuckDuckGo/Brave
- fetch: Fetch and extract content from URL
"""
import asyncio
import logging
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
from playwright.async_api import async_playwright, Browser, Page
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Web MCP Server")

# Global browser instance
browser: Browser | None = None


@app.on_event("startup")
async def startup():
    """Initialize Playwright browser."""
    global browser
    logger.info("Starting Playwright browser...")
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True)
    logger.info("Browser ready")


@app.on_event("shutdown")
async def shutdown():
    """Close browser."""
    if browser:
        await browser.close()


class ToolsListRequest(BaseModel):
    """Empty request for tools/list."""

    pass


class ToolCallRequest(BaseModel):
    """Tool call request."""

    name: str
    arguments: dict[str, Any]


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


@app.post("/tools/list")
async def list_tools(request: ToolsListRequest | None = None):
    """Return available tools."""
    return {
        "tools": [
            {
                "name": "search",
                "description": "Search the web for information. Returns a list of search results with titles, URLs, and snippets.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query",
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 5,
                        },
                        "site": {
                            "type": "string",
                            "description": "Optional site restriction (e.g., 'wikipedia.org')",
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "fetch",
                "description": "Fetch and extract content from a URL. Returns the page title, URL, main text content, and links.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to fetch",
                        },
                        "max_links": {
                            "type": "integer",
                            "description": "Maximum number of links to return",
                            "default": 10,
                        },
                    },
                    "required": ["url"],
                },
            },
        ]
    }


@app.post("/tools/call")
async def call_tool(request: ToolCallRequest):
    """Execute a tool."""
    tool_name = request.name
    arguments = request.arguments

    logger.info(f"Tool call: {tool_name} with args: {arguments}")

    if tool_name == "search":
        result = await search_web(
            query=arguments["query"],
            top_k=arguments.get("top_k", 5),
            site=arguments.get("site"),
        )
    elif tool_name == "fetch":
        result = await fetch_url(
            url=arguments["url"],
            max_links=arguments.get("max_links", 10),
        )
    else:
        result = {"error": f"Unknown tool: {tool_name}"}

    return {"content": [{"type": "text", "text": str(result)}]}


async def search_web(query: str, top_k: int = 5, site: str | None = None) -> dict[str, Any]:
    """
    Search the web using DuckDuckGo HTML search.

    Args:
        query: Search query
        top_k: Number of results
        site: Optional site restriction

    Returns:
        Search results
    """
    if not browser:
        return {"error": "Browser not initialized"}

    try:
        # Build search query
        search_query = query
        if site:
            search_query = f"site:{site} {query}"

        # Use DuckDuckGo HTML search
        search_url = f"https://html.duckduckgo.com/html/?q={search_query}"

        page = await browser.new_page()
        await page.goto(search_url, wait_until="domcontentloaded")

        # Extract results
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        results = []
        for result_div in soup.select(".result")[:top_k]:
            title_elem = result_div.select_one(".result__title")
            snippet_elem = result_div.select_one(".result__snippet")
            url_elem = result_div.select_one(".result__url")

            if title_elem and url_elem:
                results.append(
                    {
                        "title": title_elem.get_text(strip=True),
                        "url": url_elem.get("href", ""),
                        "snippet": snippet_elem.get_text(strip=True) if snippet_elem else "",
                    }
                )

        await page.close()

        logger.info(f"Search returned {len(results)} results")
        return {"results": results, "query": query}

    except Exception as e:
        logger.error(f"Search failed: {e}")
        return {"error": str(e)}


async def fetch_url(url: str, max_links: int = 10) -> dict[str, Any]:
    """
    Fetch and extract content from a URL.

    Args:
        url: URL to fetch
        max_links: Max links to extract

    Returns:
        Page content with title, text, and links
    """
    if not browser:
        return {"error": "Browser not initialized"}

    try:
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Get title
        title = await page.title()

        # Get main content
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()

        # Extract text
        text = soup.get_text(separator="\n", strip=True)

        # Extract links
        links = []
        for a in soup.find_all("a", href=True)[:max_links]:
            href = a["href"]
            link_text = a.get_text(strip=True)
            if href.startswith("http") and link_text:
                links.append({"url": href, "text": link_text})

        await page.close()

        logger.info(f"Fetched {url}: {len(text)} chars, {len(links)} links")

        return {
            "title": title,
            "url": url,
            "text": text[:5000],  # Limit text size
            "links": links,
        }

    except Exception as e:
        logger.error(f"Fetch failed for {url}: {e}")
        return {"error": str(e), "url": url}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7001)
