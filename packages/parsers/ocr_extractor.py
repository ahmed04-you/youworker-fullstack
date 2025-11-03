from __future__ import annotations

from pathlib import Path
from typing import Iterator, Sequence
from uuid import uuid4

import pdfplumber
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from packages.common import get_logger
from packages.vectorstore.schema import DocumentSource

from .models import DocChunk

logger = get_logger(__name__)

try:
    import pytesseract  # type: ignore

    PYTESSERACT_AVAILABLE = True
except ImportError:  # pragma: no cover
    pytesseract = None
    PYTESSERACT_AVAILABLE = False


def should_run_ocr(mime: str | None, text_chunks: Sequence[DocChunk]) -> bool:
    """Decide whether OCR should be attempted for the given document."""
    mime = (mime or "").lower()
    if mime.startswith("image/"):
        return True
    if mime == "application/pdf":
        return not any(chunk.text.strip() for chunk in text_chunks)
    return False


def _prepare_image_variants(image: Image.Image) -> list[Image.Image]:
    """Generate OCR-friendly variants of the provided image."""
    variants: list[Image.Image] = []

    try:
        working = ImageOps.exif_transpose(image.copy())
    except Exception:
        working = image.copy()

    if working.mode not in {"RGB", "L"}:
        working = working.convert("RGB")

    width, height = working.size
    min_target = 800
    if min(width, height) < min_target:
        scale = min_target / max(1, min(width, height))
        new_size = (int(width * scale), int(height * scale))
        try:
            working = working.resize(new_size, Image.Resampling.BICUBIC)
        except AttributeError:  # Pillow < 10 fallback
            working = working.resize(new_size, Image.BICUBIC)

    grayscale = ImageOps.grayscale(working)
    variants.append(grayscale.copy())

    autocontrast = ImageOps.autocontrast(grayscale)
    variants.append(autocontrast.copy())

    sharpened = ImageEnhance.Sharpness(autocontrast).enhance(1.6)
    variants.append(sharpened.copy())

    denoised = sharpened.filter(ImageFilter.MedianFilter(size=3))
    variants.append(denoised.copy())

    threshold = autocontrast.point(lambda x: 255 if x > 160 else 0, mode="1").convert("L")
    variants.append(threshold.copy())

    return variants


def extract(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """
    Perform OCR over an image or scanned PDF using CPU-only processing.

    Uses Tesseract OCR for reliable, CPU-based text extraction.
    """
    mime = (mime or "").lower()

    if mime.startswith("image/"):
        yield from _extract_image(path, uri=uri, mime=mime, source=source)
    elif mime == "application/pdf":
        yield from _extract_scanned_pdf(path, uri=uri, mime=mime, source=source)


def _extract_image(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract text from an image file using OCR."""
    with Image.open(path) as image:
        try:
            text = run_ocr_image(image)
        except Exception as exc:  # pragma: no cover
            logger.warning("ocr-image-process-failed", extra={"path": str(path), "error": str(exc)})
            return
        if not text.strip():
            return
        yield DocChunk(
            id=str(uuid4()),
            chunk_id=1,
            text=text.strip(),
            uri=uri,
            mime=mime,
            source=source,
            metadata={"ocr_used": True, "ocr_engine": "tesseract"},
        )


def _extract_scanned_pdf(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract text from scanned PDF pages using OCR."""
    try:
        with pdfplumber.open(path) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                try:
                    page_image = page.to_image(resolution=300).original
                except Exception as exc:  # pragma: no cover
                    logger.warning(
                        "ocr-page-render-failed",
                        extra={"path": str(path), "page": idx, "error": str(exc)},
                    )
                    continue
                try:
                    text = run_ocr_image(page_image)
                finally:
                    try:
                        page_image.close()
                    except Exception:
                        pass
                if not text.strip():
                    continue
                yield DocChunk(
                    id=str(uuid4()),
                    chunk_id=idx,
                    text=text.strip(),
                    uri=uri,
                    mime=mime,
                    source=source,
                    metadata={"page": idx, "ocr_used": True, "ocr_engine": "tesseract"},
                )
    except Exception as exc:  # pragma: no cover
        logger.warning("ocr-pdf-open-failed", extra={"path": str(path), "error": str(exc)})


def run_ocr_image(image: Image.Image) -> str:
    """
    Run OCR on an image using Tesseract (CPU-only).

    Tesseract is a robust, CPU-based OCR engine that doesn't require GPU acceleration.
    """
    if not PYTESSERACT_AVAILABLE:
        raise RuntimeError(
            "pytesseract is not available for OCR. Install it with: uv add pytesseract"
        )

    logger.info("ocr-run", extra={"engine": "tesseract", "device": "cpu"})

    variants = _prepare_image_variants(image)
    configs = ["--oem 3 --psm 6", "--oem 3 --psm 4", "--oem 1 --psm 6"]
    best_text = ""

    try:
        for variant in variants:
            for config in configs:
                try:
                    candidate = pytesseract.image_to_string(variant, config=config)
                except pytesseract.pytesseract.TesseractError as exc:  # pragma: no cover
                    logger.warning("ocr-run-error", extra={"config": config, "error": str(exc)})
                    continue
                candidate = (candidate or "").strip()
                if candidate and not candidate.isspace():
                    return candidate
                if not best_text and candidate:
                    best_text = candidate
        return best_text
    finally:
        for variant in variants:
            try:
                variant.close()
            except Exception:
                pass
