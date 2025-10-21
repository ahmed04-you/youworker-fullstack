"""
MCP server for web search and fetch capabilities.

Tools:
- search: Web search via DuckDuckGo HTML
- fetch: Fetch and extract content from URL
"""
import asyncio
import ipaddress
import json
import logging
import re
import socket
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from bs4 import BeautifulSoup

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
        logger.error(f"Search failed: {exc}")
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

    logger.info(f"Search returned {len(results)} results")
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
        logger.error(f"Fetch failed for {url}: {exc}")
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

    logger.info(f"Fetched {url}: {len(text)} chars, {len(links)} links")
    return {"title": title, "url": url, "text": text[:5000], "links": links}


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


def get_tools_schema() -> list[dict[str, Any]]:
    """Return tool definitions in MCP schema."""
    return [
        {
            "name": "search",
            "description": "Search the web for information. Returns a list of search results with titles, URLs, and snippets.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query",
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
                        "description": "Optional site restriction (e.g., 'wikipedia.org')",
                        "minLength": 3,
                        "maxLength": 128,
                        "pattern": r"^[A-Za-z0-9.-]+$",
                    },
                },
                "required": ["query"],
                "additionalProperties": False,
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
                        "minLength": 8,
                        "maxLength": 2048,
                        "pattern": r"^https?://.+$",
                    },
                    "max_links": {
                        "type": "integer",
                        "description": "Maximum number of links to return",
                        "default": 10,
                        "minimum": 1,
                        "maximum": MAX_FETCH_LINKS,
                    },
                },
                "required": ["url"],
                "additionalProperties": False,
            },
        },
    ]


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    """JSON-RPC 2.0 over WebSocket endpoint implementing MCP methods."""
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                req = json.loads(raw)
            except Exception as pe:
                await ws.send_text(
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": -32700, "message": "Parse error", "data": {"raw": str(raw)[:200]}},
                    })
                )
                continue

            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {}) or {}

            try:
                if method == "initialize":
                    result = {
                        "protocolVersion": "2024-10-01",
                        "serverInfo": {"name": "web", "version": "0.1.0"},
                        "capabilities": {"tools": {"list": True, "call": True}},
                    }
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}))

                elif method == "tools/list":
                    await ws.send_text(
                        json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"tools": get_tools_schema()}})
                    )

                elif method == "tools/call":
                    name = params.get("name")
                    arguments = params.get("arguments", {})
                    if name == "search":
                        result = await search_web(
                            query=arguments["query"],
                            top_k=arguments.get("top_k", 5),
                            site=arguments.get("site"),
                        )
                    elif name == "fetch":
                        result = await fetch_url(
                            url=arguments["url"],
                            max_links=arguments.get("max_links", 10),
                        )
                    else:
                        await ws.send_text(
                            json.dumps({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "error": {"code": -32601, "message": f"Unknown tool: {name}", "data": {"name": name}},
                            })
                        )
                        continue

                    await ws.send_text(
                        json.dumps(
                            {
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "result": {"content": [{"type": "json", "json": result}]},
                            }
                        )
                    )

                elif method == "ping":
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}))

                else:
                    await ws.send_text(
                        json.dumps({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "error": {"code": -32601, "message": "Method not found", "data": {"method": method}},
                        })
                    )

            except Exception as e:
                await ws.send_text(
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32000, "message": str(e), "data": {"type": type(e).__name__}},
                    })
                )

    except WebSocketDisconnect:
        logger.info("MCP WebSocket disconnected")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7001)
