"""
Playwright-based web scraping client for document ingestion.
"""
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

from playwright.async_api import async_playwright, Browser, Page
from bs4 import BeautifulSoup

if TYPE_CHECKING:
    from packages.common import Settings

logger = logging.getLogger(__name__)


@dataclass
class PlaywrightConfig:
    """Configuration for Playwright client."""

    headless: bool = True
    timeout: int = 30000  # 30 seconds
    user_agent: str | None = None


class PlaywrightClient:
    """
    Async context manager for Playwright-based web scraping.

    Usage:
        async with PlaywrightClient(config, settings) as client:
            pages = await client.crawl(url, depth=2)
    """

    def __init__(self, config: PlaywrightConfig, settings: "Settings"):
        self.config = config
        self.settings = settings
        self._playwright = None
        self._browser: Browser | None = None

    async def __aenter__(self):
        """Initialize Playwright and browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.config.headless
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup browser and Playwright."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def crawl(self, start_url: str, depth: int = 1) -> list[dict]:
        """
        Crawl a website starting from the given URL.

        Args:
            start_url: Starting URL
            depth: Maximum crawl depth (currently only depth=1 implemented)

        Returns:
            List of page dicts with {url, html, title}
        """
        if not self._browser:
            raise RuntimeError("Browser not initialized. Use async context manager.")

        pages = []
        visited = set()

        # For now, implement simple single-page fetch
        # TODO: Implement full depth-based crawling
        try:
            page = await self._browser.new_page()

            if self.config.user_agent:
                await page.set_extra_http_headers({"User-Agent": self.config.user_agent})

            await page.goto(start_url, timeout=self.config.timeout)
            await page.wait_for_load_state("networkidle", timeout=self.config.timeout)

            html = await page.content()
            title = await page.title()

            pages.append({
                "url": start_url,
                "html": html,
                "title": title,
            })

            visited.add(start_url)
            await page.close()

        except Exception as e:
            logger.error(f"Failed to crawl {start_url}: {e}")

        return pages

    async def fetch_page(self, url: str) -> dict | None:
        """
        Fetch a single page.

        Args:
            url: URL to fetch

        Returns:
            Page dict with {url, html, title, text} or None if failed
        """
        if not self._browser:
            raise RuntimeError("Browser not initialized. Use async context manager.")

        try:
            page = await self._browser.new_page()

            if self.config.user_agent:
                await page.set_extra_http_headers({"User-Agent": self.config.user_agent})

            await page.goto(url, timeout=self.config.timeout)
            await page.wait_for_load_state("networkidle", timeout=self.config.timeout)

            html = await page.content()
            title = await page.title()

            # Extract text using BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()

            text = soup.get_text(separator="\n", strip=True)

            await page.close()

            return {
                "url": url,
                "html": html,
                "title": title,
                "text": text,
            }

        except Exception as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None
