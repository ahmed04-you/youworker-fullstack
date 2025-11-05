"""
MCP server for web research and fetching capabilities.

Tools:
- web_search: Web search via DuckDuckGo HTML
- web_fetch: Fetch and extract basic content from URL
- web_extract_article: Extract main article content with readability
- web_crawl: Crawl a page and its outgoing links (depth 1–2)
"""

import asyncio
import os
import ipaddress
import logging
import re
import socket
from typing import Any
from urllib.parse import urlparse

import httpx
from readability import Document
from fastapi import FastAPI, WebSocket
from bs4 import BeautifulSoup

from packages.mcp.base_handler import (
    MCPProtocolHandler,
    MCPServerInfo,
    mcp_websocket_handler,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Web MCP Server")

# Global HTTP client instance
http_client: httpx.AsyncClient | None = None

MAX_RESPONSE_BYTES = 2_000_000
MAX_FETCH_LINKS = 50
MAX_TOP_K = 10
QUERY_MIN_LEN = 3
QUERY_MAX_LEN = 256
SITE_PATTERN = re.compile(r"^[A-Za-z0-9.-]+$")
CRAWL_MAX_DEPTH = 2
CRAWL_MAX_PAGES = 10
RESPECT_ROBOTS_DEFAULT = True


@app.on_event("startup")
async def startup():
    """Initialize HTTP client."""
    global http_client
    logger.info("Starting HTTP client...")
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, read=10.0, connect=5.0),
        headers={"User-Agent": "youworker-web-mcp/0.1 (+https://example.local)"},
        follow_redirects=False,
    )
    logger.info("HTTP client ready")


@app.on_event("shutdown")
async def shutdown():
    """Close HTTP client."""
    global http_client
    if http_client:
        await http_client.aclose()
    http_client = None


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


async def search_web(query: str, top_k: int = 5, site: str | None = None) -> dict[str, Any]:
    """Search the web using DuckDuckGo HTML endpoint over HTTP."""
    if not http_client:
        return {"error": "HTTP client not initialized"}

    if not isinstance(query, str):
        return {"error": "query must be a string"}
    query = query.strip()
    if len(query) < QUERY_MIN_LEN or len(query) > QUERY_MAX_LEN:
        return {
            "error": f"query must be between {QUERY_MIN_LEN} and {QUERY_MAX_LEN} characters",
        }

    if not isinstance(top_k, int):
        return {"error": "top_k must be an integer"}
    if top_k < 1 or top_k > MAX_TOP_K:
        return {"error": f"top_k must be between 1 and {MAX_TOP_K}"}

    if site:
        if not isinstance(site, str):
            return {"error": "site must be a string"}
        site = site.strip()
        if len(site) < 3 or len(site) > 128 or not SITE_PATTERN.fullmatch(site):
            return {"error": "site must be 3-128 characters [A-Za-z0-9.-]"}

    search_query = f"site:{site} {query}" if site else query

    try:
        resp = await _request_with_retries(
            "POST",
            "https://html.duckduckgo.com/html/",
            data={"q": search_query},
            headers={"Accept": "text/html"},
        )
    except Exception as exc:
        logger.error(
            "Search failed",
            extra={"error": str(exc), "error_type": type(exc).__name__, "query": search_query}
        )
        return {"error": f"Search request failed: {exc}"}

    content_type = resp.headers.get("content-type", "").lower()
    if "text/html" not in content_type:
        return {"error": f"Unexpected content type: {content_type or 'unknown'}"}

    if len(resp.content) > MAX_RESPONSE_BYTES:
        return {"error": "Search response exceeded size limit"}

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for result_div in soup.select(".result")[:top_k]:
        title_elem = result_div.select_one(".result__title")
        snippet_elem = result_div.select_one(".result__snippet")
        link_elem = result_div.select_one(".result__a, .result__url")

        title = title_elem.get_text(strip=True) if title_elem else ""
        url = link_elem.get("href", "") if link_elem else ""
        snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""
        if title or url or snippet:
            results.append({"title": title, "url": url, "snippet": snippet})

    logger.info(
        "Search completed",
        extra={"result_count": len(results), "query": query}
    )
    return {"results": results, "query": query}


async def fetch_url(url: str, max_links: int = 10) -> dict[str, Any]:
    """Fetch and extract content from a URL over HTTP."""
    if not http_client:
        return {"error": "HTTP client not initialized"}

    if not isinstance(max_links, int):
        return {"error": "max_links must be an integer"}
    if max_links < 1 or max_links > MAX_FETCH_LINKS:
        return {"error": f"max_links must be between 1 and {MAX_FETCH_LINKS}"}

    try:
        safe_url = await _ensure_safe_url(url)
    except ValueError as exc:
        return {"error": str(exc)}

    try:
        resp = await _request_with_retries(
            "GET",
            safe_url,
            headers={"Accept": "text/html"},
        )
    except Exception as exc:
        logger.error(
            "Fetch failed",
            extra={"error": str(exc), "error_type": type(exc).__name__, "url": url}
        )
        return {"error": f"Fetch request failed: {exc}", "url": url}

    content_type = resp.headers.get("content-type", "").lower()
    if "text/html" not in content_type:
        return {"error": f"Unsupported content type: {content_type or 'unknown'}", "url": url}

    if len(resp.content) > MAX_RESPONSE_BYTES:
        return {"error": "Fetched page exceeded size limit", "url": url}

    html = resp.text
    if len(html) > MAX_RESPONSE_BYTES:
        html = html[:MAX_RESPONSE_BYTES]

    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        link_text = a.get_text(strip=True)
        if href.startswith("http") and link_text:
            links.append({"url": href, "text": link_text})
        if len(links) >= max_links:
            break

    logger.info(
        "URL fetched successfully",
        extra={"url": url, "text_length": len(text), "link_count": len(links)}
    )
    return {"title": title, "url": url, "text": text[:5000], "links": links}


async def extract_readable(
    url: str, include_links: bool = False, max_chars: int = 5000
) -> dict[str, Any]:
    """Extract main article content and metadata using readability-lxml."""
    if not http_client:
        return {"error": "HTTP client not initialized"}

    if not isinstance(max_chars, int) or max_chars < 200 or max_chars > 50_000:
        return {"error": "max_chars must be between 200 and 50000"}

    try:
        safe_url = await _ensure_safe_url(url)
    except ValueError as exc:
        return {"error": str(exc)}

    try:
        resp = await _request_with_retries(
            "GET",
            safe_url,
            headers={"Accept": "text/html"},
        )
    except Exception as exc:
        logger.error(
            "Readable fetch failed",
            extra={"error": str(exc), "error_type": type(exc).__name__, "url": url}
        )
        return {"error": f"Fetch failed: {exc}", "url": url}

    content_type = resp.headers.get("content-type", "").lower()
    if "text/html" not in content_type:
        return {"error": f"Unsupported content type: {content_type or 'unknown'}", "url": url}

    html = resp.text
    if len(html) > MAX_RESPONSE_BYTES:
        html = html[:MAX_RESPONSE_BYTES]

    doc = Document(html)
    title = (doc.short_title() or doc.title() or "").strip()
    summary_html = doc.summary() or ""
    soup = BeautifulSoup(summary_html, "html.parser")
    # Strip scripts/boilerplate
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)

    links: list[dict[str, str]] = []
    if include_links:
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith("http"):
                link_text = a.get_text(strip=True)
                if link_text:
                    links.append({"url": href, "text": link_text})

    # Extract page-level metadata from original HTML
    full_soup = BeautifulSoup(html, "html.parser")
    meta: dict[str, Any] = {}
    for name in ("description", "og:description", "og:site_name", "author"):
        tag = full_soup.find("meta", attrs={"name": name}) or full_soup.find(
            "meta", attrs={"property": name}
        )
        if tag and tag.get("content"):
            meta[name] = tag.get("content")

    return {
        "title": title,
        "url": url,
        "text": text[:max_chars],
        "metadata": meta,
        **({"links": links} if include_links else {}),
    }


async def crawl(
    url: str,
    depth: int = 1,
    max_pages: int = 5,
    same_host: bool = True,
) -> dict[str, Any]:
    """Crawl a page and its outgoing links up to depth 1–2.

    Returns titles, URLs, and readable text snippets for each visited page.
    """
    if not http_client:
        return {"error": "HTTP client not initialized"}
    if not isinstance(depth, int) or depth < 0 or depth > CRAWL_MAX_DEPTH:
        return {"error": f"depth must be between 0 and {CRAWL_MAX_DEPTH}"}
    if not isinstance(max_pages, int) or max_pages < 1 or max_pages > CRAWL_MAX_PAGES:
        return {"error": f"max_pages must be between 1 and {CRAWL_MAX_PAGES}"}

    try:
        start_url = await _ensure_safe_url(url)
    except ValueError as exc:
        return {"error": str(exc)}

    start_host = urlparse(start_url).hostname

    # Simple robots.txt respect (optional, default enabled)
    respect_robots = os.environ.get("WEB_CRAWL_RESPECT_ROBOTS", "1").strip() not in {
        "0",
        "false",
        "False",
    }
    robots_cache: dict[str, set[str]] = {}

    async def allowed_by_robots(target: str) -> bool:
        if not respect_robots:
            return True
        parsed = urlparse(target)
        host = parsed.hostname or ""
        scheme = parsed.scheme or "http"
        base = f"{scheme}://{host}"
        if base not in robots_cache:
            # Fetch robots.txt once
            try:
                resp = await http_client.request(
                    "GET",
                    f"{base}/robots.txt",
                    timeout=httpx.Timeout(3.0, connect=3.0, read=3.0),
                )
                if resp.status_code == 200 and len(resp.content) < 200_000:
                    robots_cache[base] = set(resp.text.splitlines())
                else:
                    robots_cache[base] = set()
            except Exception:
                robots_cache[base] = set()

        # Very light check: disallow simple path prefixes listed in Disallow for all (*)
        lines = robots_cache.get(base) or set()
        path = parsed.path or "/"
        agent_star = False
        disallows: list[str] = []
        for line in lines:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            if s.lower().startswith("user-agent:"):
                agent = s.split(":", 1)[1].strip()
                agent_star = agent == "*"
            elif agent_star and s.lower().startswith("disallow:"):
                rule = s.split(":", 1)[1].strip()
                if rule:
                    disallows.append(rule)
        for rule in disallows:
            if path.startswith(rule):
                return False
        return True

    # BFS crawl
    from collections import deque

    visited: set[str] = set()
    queue = deque([(start_url, 0)])
    results: list[dict[str, Any]] = []

    while queue and len(results) < max_pages:
        current, d = queue.popleft()
        if current in visited:
            continue
        visited.add(current)

        # Host restriction
        if same_host and urlparse(current).hostname != start_host:
            continue
        if not await allowed_by_robots(current):
            continue

        # Fetch page
        try:
            resp = await _request_with_retries(
                "GET",
                current,
                headers={"Accept": "text/html"},
            )
        except Exception:
            continue

        ctype = resp.headers.get("content-type", "").lower()
        if "text/html" not in ctype:
            continue
        html = resp.text
        if len(html) > MAX_RESPONSE_BYTES:
            html = html[:MAX_RESPONSE_BYTES]

        # Extract readable text snippet
        doc = Document(html)
        title = (doc.short_title() or doc.title() or "").strip()
        snippet_html = doc.summary() or ""
        snippet_soup = BeautifulSoup(snippet_html, "html.parser")
        for tag in snippet_soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        snippet_text = snippet_soup.get_text(" ", strip=True)[:500]

        if title or snippet_text:
            results.append({"title": title, "url": current, "snippet": snippet_text})

        # Enqueue outgoing links up to depth
        if d < depth:
            page_soup = BeautifulSoup(html, "html.parser")
            for a in page_soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or not href.startswith("http"):
                    continue
                try:
                    safe = await _ensure_safe_url(href)
                except ValueError:
                    continue
                if same_host and urlparse(safe).hostname != start_host:
                    continue
                if safe not in visited:
                    queue.append((safe, d + 1))

    return {"start_url": url, "pages": results}


async def _request_with_retries(
    method: str,
    url: str,
    *,
    data: Any | None = None,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
) -> httpx.Response:
    if not http_client:
        raise RuntimeError("HTTP client not initialized")

    retries = 2
    base_delay = 0.4
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            response = await http_client.request(
                method,
                url,
                data=data,
                headers=headers,
                params=params,
            )

            if 300 <= response.status_code < 400:
                raise httpx.HTTPStatusError(
                    "Redirects are not allowed",
                    request=response.request,
                    response=response,
                )

            if 500 <= response.status_code < 600 and attempt < retries:
                last_error = httpx.HTTPStatusError(
                    "Server error", request=response.request, response=response
                )
                await asyncio.sleep(base_delay * (attempt + 1))
                continue

            response.raise_for_status()
            return response

        except httpx.HTTPStatusError as exc:
            if 500 <= exc.response.status_code < 600 and attempt < retries:
                last_error = exc
                await asyncio.sleep(base_delay * (attempt + 1))
                continue
            raise
        except (httpx.RequestError, asyncio.TimeoutError) as exc:
            last_error = exc
            if attempt < retries:
                await asyncio.sleep(base_delay * (attempt + 1))
                continue
            raise

    assert last_error is not None  # pragma: no cover
    raise last_error


async def _ensure_safe_url(raw_url: str) -> str:
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise ValueError("url must be a non-empty string")

    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https URLs are allowed")

    if not parsed.hostname:
        raise ValueError("URL must include a hostname")

    host = parsed.hostname

    try:
        ipaddress.ip_address(host)
        addresses = {host}
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            infos = await loop.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
        except Exception as exc:
            raise ValueError("Unable to resolve host") from exc
        addresses = {info[4][0] for info in infos if info and info[4]}

    if not addresses:
        raise ValueError("Unable to resolve host")

    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError("URL resolves to a disallowed IP address")

    return parsed.geturl()


# Initialize MCP protocol handler
mcp_handler = MCPProtocolHandler(
    server_info=MCPServerInfo(
        name="web",
        version="0.1.0",
    )
)

# Register tools
mcp_handler.register_tool(
    name="search",
    description="Search the web via DuckDuckGo. Returns titles, URLs, and snippets.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query",
                "minLength": QUERY_MIN_LEN,
                "maxLength": QUERY_MAX_LEN,
            },
            "top_k": {
                "type": "integer",
                "description": "Number of results to return",
                "default": 5,
                "minimum": 1,
                "maximum": MAX_TOP_K,
            },
            "site": {
                "type": "string",
                "description": "Restrict to specific site (e.g., 'wikipedia.org')",
                "minLength": 3,
                "maxLength": 128,
                "pattern": r"^[A-Za-z0-9.-]+$",
            },
        },
        "required": ["query"],
        "additionalProperties": False,
    },
    handler=search_web,
)

mcp_handler.register_tool(
    name="fetch",
    description="Fetch page content from URL. Returns title, text, and links.",
    input_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL to fetch",
                "minLength": 8,
                "maxLength": 2048,
                "pattern": r"^https?://.+$",
            },
            "max_links": {
                "type": "integer",
                "description": "Maximum links to extract",
                "default": 10,
                "minimum": 1,
                "maximum": MAX_FETCH_LINKS,
            },
        },
        "required": ["url"],
        "additionalProperties": False,
    },
    handler=fetch_url,
)

mcp_handler.register_tool(
    name="extract_article",
    description="Extract clean article content from URL using readability algorithm. Best for news articles and blogs.",
    input_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "Article URL",
                "minLength": 8,
                "maxLength": 2048,
                "pattern": r"^https?://.+$",
            },
            "include_links": {
                "type": "boolean",
                "description": "Include links from article",
                "default": False,
            },
            "max_chars": {
                "type": "integer",
                "description": "Maximum characters to return",
                "default": 5000,
                "minimum": 200,
                "maximum": 50000,
            },
        },
        "required": ["url"],
        "additionalProperties": False,
    },
    handler=extract_readable,
)

mcp_handler.register_tool(
    name="crawl",
    description="Crawl website starting from URL. Follows links up to specified depth. Returns pages with titles and snippets.",
    input_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "Starting URL",
                "minLength": 8,
                "maxLength": 2048,
                "pattern": r"^https?://.+$",
            },
            "depth": {
                "type": "integer",
                "description": "Crawl depth (0=only starting page, 1=1 link away, 2=2 links away)",
                "default": 1,
                "minimum": 0,
                "maximum": CRAWL_MAX_DEPTH,
            },
            "max_pages": {
                "type": "integer",
                "description": "Maximum pages to crawl",
                "default": 5,
                "minimum": 1,
                "maximum": CRAWL_MAX_PAGES,
            },
            "same_host": {
                "type": "boolean",
                "description": "Only crawl pages on the same domain",
                "default": True,
            },
        },
        "required": ["url"],
        "additionalProperties": False,
    },
    handler=crawl,
)


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    """MCP WebSocket endpoint using base handler."""
    await mcp_websocket_handler(ws, mcp_handler)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7001)
