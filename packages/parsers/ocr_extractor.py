from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Sequence
from uuid import uuid4

import pdfplumber
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from packages.common import get_logger, get_settings
from packages.vectorstore.schema import DocumentSource

from .models import DocChunk

logger = get_logger(__name__)

try:  # pragma: no cover - optional dependency
    import pytesseract  # type: ignore

    _PYTESSERACT_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    pytesseract = None  # type: ignore
    _PYTESSERACT_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from paddleocr import PaddleOCR  # type: ignore

    _PADDLE_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    PaddleOCR = None  # type: ignore
    _PADDLE_AVAILABLE = False


@dataclass(slots=True)
class OCRResult:
    text: str
    confidence: float | None = None


class OCREngineError(RuntimeError):
    """Raised when the OCR engine cannot be initialised or executed."""


class BaseOCREngine:
    """Common interface for OCR engines."""

    name: str = "base"

    def run_image(self, image: Image.Image) -> OCRResult:
        raise NotImplementedError


class TesseractOCREngine(BaseOCREngine):
    """OCR engine backed by Tesseract via pytesseract."""

    name = "tesseract"

    def __init__(self) -> None:
        if not _PYTESSERACT_AVAILABLE:
            raise OCREngineError(
                "pytesseract is not installed. Install it with: uv add pytesseract"
            )

    def run_image(self, image: Image.Image) -> OCRResult:
        logger.info("ocr-run", extra={"engine": self.name, "device": "cpu"})
        variants = self._prepare_image_variants(image)
        configs = ("--oem 3 --psm 6", "--oem 3 --psm 4", "--oem 1 --psm 6")
        best_text = ""

        try:
            for variant in variants:
                for config in configs:
                    try:
                        candidate = pytesseract.image_to_string(variant, config=config)  # type: ignore[attr-defined]
                    except Exception as exc:  # pragma: no cover - defensive
                        logger.warning(
                            "ocr-run-error",
                            extra={"config": config, "engine": self.name, "error": str(exc)},
                        )
                        continue
                    candidate = (candidate or "").strip()
                    if candidate and not candidate.isspace():
                        return OCRResult(text=candidate)
                    if not best_text and candidate:
                        best_text = candidate
            return OCRResult(text=best_text)
        finally:
            for variant in variants:
                try:
                    variant.close()
                except Exception:  # pragma: no cover - best effort
                    pass

    @staticmethod
    def _prepare_image_variants(image: Image.Image) -> list[Image.Image]:
        """Generate OCR-friendly variants of the provided image."""
        variants: list[Image.Image] = []

        try:
            working = ImageOps.exif_transpose(image.copy())
        except Exception:  # pragma: no cover - fallback
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
            except AttributeError:  # pragma: no cover - Pillow < 10 fallback
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


class PaddleOCREngine(BaseOCREngine):
    """OCR engine backed by PaddleOCR with optional GPU acceleration."""

    name = "paddle"

    def __init__(self, *, use_gpu: bool, language: str | None = None) -> None:
        if not _PADDLE_AVAILABLE:
            raise OCREngineError(
                "paddleocr is not installed. Install it with: uv add paddleocr paddlepaddle"
            )
        lang = (language or "en").strip() or "en"
        try:
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                use_gpu=use_gpu,
                lang=lang,
                show_log=False,
            )
        except Exception as exc:  # pragma: no cover - runtime configuration errors
            raise OCREngineError(f"Failed to initialise PaddleOCR: {exc}") from exc
        self._language = lang
        self._use_gpu = use_gpu

    def run_image(self, image: Image.Image) -> OCRResult:
        try:
            import numpy as np  # type: ignore
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise OCREngineError("numpy is required for PaddleOCR. Install it with: uv add numpy") from exc

        array = np.asarray(image.convert("RGB"))
        try:
            result = self._ocr.ocr(array, det=True, rec=True)
        except Exception as exc:  # pragma: no cover - inference failure
            raise OCREngineError(f"PaddleOCR inference failed: {exc}") from exc

        lines: list[str] = []
        confidences: list[float] = []
        for block in result or []:
            for _, (text, conf) in block:
                text = (text or "").strip()
                if not text:
                    continue
                lines.append(text)
                try:
                    confidences.append(float(conf))
                except (TypeError, ValueError):
                    continue

        combined = "\n".join(lines)
        confidence = sum(confidences) / len(confidences) if confidences else None
        logger.info(
            "ocr-run",
            extra={
                "engine": self.name,
                "device": "gpu" if self._use_gpu else "cpu",
                "language": self._language,
                "lines": len(lines),
            },
        )
        return OCRResult(text=combined, confidence=confidence)


_ENGINE: BaseOCREngine | None = None


def should_run_ocr(mime: str | None, text_chunks: Sequence[DocChunk]) -> bool:
    """Decide whether OCR should be attempted for the given document."""
    mime = (mime or "").lower()
    if mime.startswith("image/"):
        return True
    if mime == "application/pdf":
        return not any(chunk.text.strip() for chunk in text_chunks)
    return False


def extract(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """
    Perform OCR over an image or scanned PDF using the configured OCR engine.
    """
    mime = (mime or "").lower()
    try:
        engine = _get_engine()
    except OCREngineError as exc:
        logger.warning("ocr-engine-unavailable", extra={"error": str(exc)})
        return iter(())

    if mime.startswith("image/"):
        return _extract_image(engine, path, uri=uri, mime=mime, source=source)
    if mime == "application/pdf":
        return _extract_scanned_pdf(engine, path, uri=uri, mime=mime, source=source)
    return iter(())


def _extract_image(
    engine: BaseOCREngine,
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract text from an image file using the configured OCR engine."""
    with Image.open(path) as image:
        try:
            result = engine.run_image(image)
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "ocr-image-process-failed",
                extra={"path": str(path), "ocr_engine": engine.name, "error": str(exc)},
            )
            return iter(())

    text = (result.text or "").strip()
    if not text:
        return iter(())

    metadata = {"ocr_used": True, "ocr_engine": engine.name}
    if result.confidence is not None:
        metadata["ocr_confidence"] = round(result.confidence, 4)

    return iter(
        [
            DocChunk(
                id=str(uuid4()),
                chunk_id=1,
                text=text,
                uri=uri,
                mime=mime,
                source=source,
                metadata=metadata,
            )
        ]
    )


def _extract_scanned_pdf(
    engine: BaseOCREngine,
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract text from scanned PDF pages using the configured OCR engine."""
    try:
        pdf = pdfplumber.open(path)
    except Exception as exc:  # pragma: no cover
        logger.warning("ocr-pdf-open-failed", extra={"path": str(path), "error": str(exc)})
        return iter(())

    chunks: list[DocChunk] = []
    with pdf:
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
                result = engine.run_image(page_image)
            except Exception as exc:  # pragma: no cover
                logger.warning(
                    "ocr-page-process-failed",
                    extra={"path": str(path), "page": idx, "ocr_engine": engine.name, "error": str(exc)},
                )
                continue
            finally:
                try:
                    page_image.close()
                except Exception:  # pragma: no cover
                    pass

            text = (result.text or "").strip()
            if not text:
                continue

            metadata = {"page": idx, "ocr_used": True, "ocr_engine": engine.name}
            if result.confidence is not None:
                metadata["ocr_confidence"] = round(result.confidence, 4)

            chunks.append(
                DocChunk(
                    id=str(uuid4()),
                    chunk_id=idx,
                    text=text,
                    uri=uri,
                    mime=mime,
                    source=source,
                    metadata=metadata,
                )
            )

    return iter(chunks)


def _get_engine() -> BaseOCREngine:
    global _ENGINE
    if _ENGINE is not None:
        return _ENGINE

    settings = get_settings()
    engine_choice = (settings.ingest_ocr_engine or "tesseract").strip().lower()

    if engine_choice == "paddle":
        use_gpu = _should_use_gpu(settings)
        try:
            _ENGINE = PaddleOCREngine(use_gpu=use_gpu, language=settings.ingest_ocr_language)
            return _ENGINE
        except OCREngineError as exc:
            logger.warning(
                "ocr-engine-init-warning",
                extra={"engine": "paddle", "error": str(exc)},
            )
            # Fallback to Tesseract if available
            engine_choice = "tesseract"

    if engine_choice == "tesseract":
        try:
            _ENGINE = TesseractOCREngine()
            return _ENGINE
        except OCREngineError as exc:
            logger.warning(
                "ocr-engine-init-warning",
                extra={"engine": "tesseract", "error": str(exc)},
            )
            # If Tesseract is not available, try Paddle before giving up
            if settings.ingest_ocr_engine != "paddle":
                try:
                    _ENGINE = PaddleOCREngine(
                        use_gpu=_should_use_gpu(settings),
                        language=settings.ingest_ocr_language,
                    )
                    return _ENGINE
                except OCREngineError as paddle_exc:
                    raise OCREngineError(
                        f"No usable OCR engine available (tesseract error: {exc}; paddle error: {paddle_exc})"
                    ) from paddle_exc
            raise

    raise OCREngineError(f"Unsupported OCR engine: {settings.ingest_ocr_engine}")


def _should_use_gpu(settings) -> bool:
    """Decide whether to request GPU acceleration for PaddleOCR."""
    accelerator = (settings.ingest_ocr_accelerator or settings.ingest_accelerator or "auto").lower()
    if accelerator in {"cuda", "gpu"}:
        return True
    return False


# Backwards-compatibility exports ------------------------------------------------
PYTESSERACT_AVAILABLE = _PYTESSERACT_AVAILABLE


def run_ocr_image(image: Image.Image) -> str:
    """
    Legacy helper retained for modules (e.g., docling extractor) that request OCR directly.
    """
    try:
        engine = _get_engine()
    except OCREngineError as exc:
        logger.warning("ocr-engine-unavailable", extra={"error": str(exc)})
        return ""

    try:
        result = engine.run_image(image)
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "ocr-run-image-error",
            extra={"ocr_engine": engine.name, "error": str(exc)},
        )
        return ""
    return (result.text or "").strip()
