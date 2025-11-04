"""
Qwen3-VL Vision Parser for document analysis.

Uses Qwen3-VL:4b-instruct via Ollama to extract structured markdown from document images.
Focuses on preserving all content with artifact markup for tables, charts, etc.
"""

import asyncio
import base64
import logging
from typing import Any

import httpx
from PIL import Image

from packages.common import Settings, get_settings

logger = logging.getLogger(__name__)


class VisionParser:
    """
    Parse document images using Qwen3-VL vision model.

    Extracts:
    - All text content
    - Tables (marked with <table>...</table>)
    - Charts and graphs (marked with <chart>...</chart>)
    - Images and diagrams (marked with <image>...</image>)
    - Document structure (headings, lists, sections)
    """

    VISION_PROMPT = """Analizza questa immagine di documento ed estrai TUTTO il contenuto con il massimo dettaglio.

CRITICO: Estrai il testo nella sua LINGUA ORIGINALE. NON tradurre. Mantieni la lingua esatta come appare nel documento.

Il tuo compito:
1. Estrai TUTTO il testo ESATTAMENTE come appare, nella LINGUA ORIGINALE
2. Mantieni la struttura del documento (titoli, paragrafi, liste)
3. Identifica e marca i tipi di contenuto speciali:
   - Tabelle: Racchiudi in tag <table>...</table> con tutti i dati
   - Grafici: Racchiudi in <chart>...</chart> con descrizione e dati
   - Diagrammi/Immagini: Racchiudi in <image>...</image> con descrizione dettagliata
   - Blocchi di codice: Racchiudi in ```language ... ```

4. Formatta l'output in markdown completo:
   - Usa # per i titoli
   - Usa **grassetto** e *corsivo* dove appropriato
   - Usa - o * per liste puntate
   - Usa 1. 2. 3. per liste numerate
   - Mantieni la struttura delle tabelle con sintassi markdown | dentro i tag <table>

5. Sii esaustivo - NON saltare nessun contenuto
6. Per elementi ripetitivi (intestazioni, piè di pagina, numeri di pagina), estraili una volta ma mantienili concisi
7. Se il testo non è chiaro, includi [non chiaro: ipotesi migliore]

FORMATO OUTPUT:
Restituisci SOLO il contenuto markdown estratto. Non includere spiegazioni o metadati. Mantieni tutto il testo nella LINGUA ORIGINALE."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.base_url = self.settings.ollama_base_url
        self.model = "qwen3-vl:4b-instruct"
        self._client = httpx.AsyncClient(timeout=120.0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()

    async def analyze_image(
        self,
        image: Image.Image,
        page_metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Analyze a single image and extract structured markdown.

        Args:
            image: PIL Image to analyze
            page_metadata: Optional metadata (page number, source, etc.)

        Returns:
            Extracted markdown content
        """
        try:
            # Convert image to base64
            image_b64 = self._image_to_base64(image)

            # Build context-aware prompt
            context = ""
            if page_metadata:
                if "page_num" in page_metadata:
                    context += f"\n(This is page {page_metadata['page_num']}"
                    if "total_pages" in page_metadata:
                        context += f" of {page_metadata['total_pages']}"
                    context += ")"
                if "timestamp" in page_metadata:
                    mins = int(page_metadata["timestamp"] // 60)
                    secs = int(page_metadata["timestamp"] % 60)
                    context += f"\n(Video frame at {mins}:{secs:02d})"

            prompt = self.VISION_PROMPT + context

            # Call Qwen3-VL via Ollama
            response = await self._client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for factual extraction
                        "top_p": 0.9,
                    },
                },
            )

            if response.status_code != 200:
                logger.error(
                    f"Qwen3-VL API error: status={response.status_code}, "
                    f"body={response.text[:500]}"
                )
                return ""

            data = response.json()

            # Qwen3-VL-Instruct returns content in the 'response' field
            extracted_text = data.get("response", "").strip()

            # Debug logging
            logger.info(
                f"Qwen3-VL-Instruct response received: status={response.status_code}, "
                f"response_length={len(extracted_text)}, "
                f"preview={extracted_text[:200] if extracted_text else 'EMPTY'}"
            )

            if not extracted_text:
                logger.warning("Qwen3-VL-Instruct returned empty response")
                return ""

            # Add page marker if available
            if page_metadata and "page_num" in page_metadata:
                page_marker = f"\n\n---\n**Page {page_metadata['page_num']}**\n\n"
                extracted_text = page_marker + extracted_text

            return extracted_text

        except Exception as e:
            logger.error(f"Error analyzing image with Qwen3-VL: {e}", exc_info=True)
            return ""

    async def analyze_images_batch(
        self,
        images_with_metadata: list[dict[str, Any]],
        max_concurrent: int = 3,
    ) -> str:
        """
        Analyze multiple images concurrently and combine results.

        Args:
            images_with_metadata: List of dicts with 'image' and 'metadata'
            max_concurrent: Maximum concurrent API calls

        Returns:
            Combined markdown from all images
        """
        sem = asyncio.Semaphore(max_concurrent)

        async def analyze_one(item: dict[str, Any]) -> tuple[int, str]:
            async with sem:
                page_num = item.get("page_num", 0)
                result = await self.analyze_image(
                    image=item["image"],
                    page_metadata=item.get("metadata"),
                )
                return (page_num, result)

        # Analyze all images concurrently
        tasks = [analyze_one(item) for item in images_with_metadata]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results in order
        combined_markdown = []
        for result in sorted(results, key=lambda x: x[0] if isinstance(x, tuple) else 0):
            if isinstance(result, tuple):
                _, markdown = result
                if markdown:
                    combined_markdown.append(markdown)
            elif isinstance(result, Exception):
                logger.error(f"Error in batch analysis: {result}")

        return "\n\n".join(combined_markdown)

    @staticmethod
    def _image_to_base64(image: Image.Image) -> str:
        """Convert PIL Image to base64 string for Ollama."""
        import io

        buffer = io.BytesIO()
        # Convert to RGB if needed (remove alpha channel)
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def post_process_markdown(self, markdown: str) -> str:
        """
        Post-process extracted markdown to enhance quality.

        - Normalize whitespace
        - Fix common OCR errors
        - Ensure consistent formatting
        """
        if not markdown:
            return ""

        # Remove excessive blank lines
        lines = markdown.split("\n")
        processed_lines = []
        prev_blank = False

        for line in lines:
            is_blank = not line.strip()
            if is_blank and prev_blank:
                continue  # Skip consecutive blank lines
            processed_lines.append(line)
            prev_blank = is_blank

        return "\n".join(processed_lines)
