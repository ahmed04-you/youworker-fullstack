from __future__ import annotations

import hashlib
import io
from contextlib import suppress
from pathlib import Path
from typing import Any, Iterator
from uuid import uuid4

import pandas as pd
import pdfplumber

from packages.common import (
    AcceleratorChoice,
    coerce_preference,
    get_logger,
    get_settings,
    resolve_accelerator,
)
from packages.vectorstore.schema import DocumentSource

from .models import DocChunk
from .ocr_extractor import PYTESSERACT_AVAILABLE, run_ocr_image

logger = get_logger(__name__)
_settings = get_settings()

_DOCLING_ACCELERATOR = resolve_accelerator(
    preference=coerce_preference(
        _settings.ingest_docling_accelerator, _settings.ingest_accelerator
    ),
    explicit_device=_settings.ingest_docling_device or _settings.ingest_gpu_device,
)
_DOCLING_CHOICE: AcceleratorChoice | None = None


def _active_docling_choice() -> AcceleratorChoice:
    return _DOCLING_CHOICE or _DOCLING_ACCELERATOR


def _set_docling_choice(choice: AcceleratorChoice) -> None:
    global _DOCLING_CHOICE
    _DOCLING_CHOICE = choice


EXCEL_MIME_TYPES = {
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
EXCEL_SUFFIXES = {".xls", ".xlsx"}

# Docling imports with proper API
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend

    DOCLING_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    DOCLING_AVAILABLE = False
    DocumentConverter = None
    PdfFormatOption = None
    InputFormat = None
    PdfPipelineOptions = None
    TableFormerMode = None
    PyPdfiumDocumentBackend = None


def extract(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """
    Extract structured content using Docling with maximum structure preservation.

    Docling parses documents and extracts:
    - Text with hierarchical structure (headings, paragraphs, lists)
    - Tables with cell-level data
    - Images with descriptions
    - Page layout information
    - Document metadata

    Yields DocChunk instances with rich metadata for each content element.
    """
    if not DOCLING_AVAILABLE:
        logger.debug("docling-not-available", path=str(path))
        if _should_try_excel(path, mime):
            yield from _extract_excel_tables(path, uri=uri, mime=mime, source=source)
        else:
            yield from _fallback_pdf_text(path, uri=uri, mime=mime, source=source)
        return

    try:
        result = _convert_document(path)
        if result is None:
            if _should_try_excel(path, mime):
                yield from _extract_excel_tables(path, uri=uri, mime=mime, source=source)
            else:
                yield from _fallback_pdf_text(path, uri=uri, mime=mime, source=source)
            return

        structured_iter = _extract_structured_content(result)
        first_chunk = next(structured_iter, None)

        if first_chunk:
            yield DocChunk(
                id=str(uuid4()),
                chunk_id=1,
                text=first_chunk["text"],
                uri=uri,
                mime=mime,
                source=source,
                metadata=first_chunk["metadata"],
            )
            chunk_index = 1
            for chunk_data in structured_iter:
                chunk_index += 1
                yield DocChunk(
                    id=str(uuid4()),
                    chunk_id=chunk_index,
                    text=chunk_data["text"],
                    uri=uri,
                    mime=mime,
                    source=source,
                    metadata=chunk_data["metadata"],
                )
            return

        markdown_text = _export_markdown(result)
        if markdown_text:
            yield DocChunk(
                id=str(uuid4()),
                chunk_id=1,
                text=markdown_text,
                uri=uri,
                mime=mime,
                source=source,
                metadata={
                    "content_type": "document_markdown",
                    "exporter": "docling",
                    "format": "markdown",
                },
            )
            return

        if _should_try_excel(path, mime):
            yield from _extract_excel_tables(path, uri=uri, mime=mime, source=source)
            return

    except Exception as exc:
        logger.warning("docling-extraction-error", path=str(path), error=str(exc))
        if _should_try_excel(path, mime):
            yield from _extract_excel_tables(path, uri=uri, mime=mime, source=source)
            return

        yield from _fallback_pdf_text(path, uri=uri, mime=mime, source=source)
        return

    if _should_try_excel(path, mime):
        yield from _extract_excel_tables(path, uri=uri, mime=mime, source=source)
        return

    yield from _fallback_pdf_text(path, uri=uri, mime=mime, source=source)


def _convert_document(path: Path) -> Any:
    """
    Convert document using Docling, preferring GPU acceleration with CPU fallback.
    """
    initial_choice = _active_docling_choice()
    attempts: list[AcceleratorChoice] = [initial_choice]
    cpu_choice: AcceleratorChoice | None = None
    if initial_choice.using_gpu:
        cpu_choice = resolve_accelerator(preference="cpu")
        attempts.append(cpu_choice)

    last_error: Exception | None = None
    for choice in attempts:
        try:
            converter = _build_converter(choice)
            logger.info(
                "docling-conversion-start",
                path=str(path),
                device=choice.compute_device,
                accelerator=choice.requested,
                gpu_available=choice.gpu_available,
            )
            result = converter.convert(str(path))
            if result is None:
                logger.warning(
                    "docling-conversion-empty",
                    path=str(path),
                    device=choice.compute_device,
                )
                continue
            _set_docling_choice(choice)
            return result
        except Exception as exc:  # pragma: no cover - defensive fallback
            last_error = exc
            if choice.using_gpu and cpu_choice is not None:
                logger.warning(
                    "docling-conversion-gpu-error",
                    path=str(path),
                    device=choice.compute_device,
                    accelerator=choice.requested,
                    error=str(exc),
                )
                logger.info(
                    "docling-conversion-fallback",
                    path=str(path),
                    device=cpu_choice.compute_device,
                    accelerator=cpu_choice.requested,
                )
            else:
                logger.warning(
                    "docling-conversion-failed",
                    path=str(path),
                    device=choice.compute_device,
                    accelerator=choice.requested,
                    error=str(exc),
                )
            continue

    if last_error is not None:
        raise last_error
    return None


def _build_converter(choice: AcceleratorChoice) -> DocumentConverter:
    pipeline_options = _build_pipeline_options(choice)
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
                backend=PyPdfiumDocumentBackend,
            )
        }
    )


def _build_pipeline_options(choice: AcceleratorChoice) -> PdfPipelineOptions:
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.do_table_structure = True
    if hasattr(pipeline_options, "images_scale"):
        pipeline_options.images_scale = 2.0
    if hasattr(pipeline_options, "generate_page_images"):
        pipeline_options.generate_page_images = False
    if hasattr(pipeline_options, "generate_picture_images"):
        pipeline_options.generate_picture_images = True

    table_options = getattr(pipeline_options, "table_structure_options", None)
    if table_options is not None:
        if hasattr(table_options, "do_cell_matching"):
            table_options.do_cell_matching = True
        if TableFormerMode is not None and hasattr(table_options, "mode"):
            table_options.mode = TableFormerMode.ACCURATE
        _configure_tableformer_acceleration(table_options, choice)

    _safe_assign(pipeline_options, "device", choice.device if choice.using_gpu else "cpu")
    return pipeline_options


def _configure_tableformer_acceleration(options: object, choice: AcceleratorChoice) -> None:
    device_value = choice.device if choice.using_gpu else "cpu"
    _safe_assign(options, "device", device_value)
    _safe_assign(options, "use_gpu", choice.using_gpu)

    precision = _resolve_docling_precision(choice)
    _safe_assign(options, "precision", precision)
    _safe_assign(options, "dtype", _torch_dtype_for_precision(precision))


def _resolve_docling_precision(choice: AcceleratorChoice) -> str:
    preference = (_settings.ingest_docling_precision or "auto").strip().lower()
    if preference in {"auto", "default"}:
        return "float16" if choice.using_gpu else "float32"
    if preference in {"float16", "fp16", "half"}:
        return "float16"
    if preference in {"float32", "fp32"}:
        return "float32"
    logger.warning("docling-precision-invalid", precision=preference)
    return "float16" if choice.using_gpu else "float32"


def _torch_dtype_for_precision(precision: str) -> object:
    with suppress(ImportError, AttributeError):
        import torch

        if precision == "float16":
            return torch.float16
        if precision == "float32":
            return torch.float32
    return precision


def _safe_assign(target: object, attribute: str, value: object) -> None:
    try:
        if hasattr(target, attribute):
            setattr(target, attribute, value)
    except Exception as exc:  # pragma: no cover - best effort
        logger.debug(
            "docling-option-assign-failed",
            attribute=attribute,
            value=value,
            error=str(exc),
        )


def _export_markdown(result: Any) -> str | None:
    """Attempt to export the Docling result to markdown."""
    document = getattr(result, "document", None)
    if document is None:
        return None

    candidates = []
    if hasattr(document, "export_to_markdown"):
        candidates.append(("export_to_markdown", document.export_to_markdown))
    if hasattr(document, "export_to_string"):
        candidates.append(
            ("export_to_string", lambda: document.export_to_string(format="markdown"))
        )
    if hasattr(document, "export"):
        candidates.append(("export", lambda: document.export(format="markdown")))

    for method_name, exporter in candidates:
        try:
            output = exporter()
        except TypeError:
            # Some exporters expect keyword arguments; retry with common patterns.
            try:
                output = exporter(format="markdown")
            except TypeError:
                continue
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.debug("docling-markdown-export-error", method=method_name, error=str(exc))
            continue

        markdown_text = _coerce_markdown(output)
        if markdown_text:
            return markdown_text

    output_data = getattr(result, "output_data", None)
    if isinstance(output_data, dict):
        for key in ("markdown", "md", "document_markdown"):
            value = output_data.get(key)
            markdown_text = _coerce_markdown(value)
            if markdown_text:
                return markdown_text
    return None


def _coerce_markdown(output: Any) -> str | None:
    """Normalize various exporter return types to a markdown string."""
    if not output:
        return None

    if isinstance(output, str):
        return output.strip() or None

    if isinstance(output, (list, tuple)):
        for item in output:
            markdown_text = _coerce_markdown(item)
            if markdown_text:
                return markdown_text
        return None

    if hasattr(output, "main_content"):
        main_content = getattr(output, "main_content")
        if isinstance(main_content, str) and main_content.strip():
            return main_content.strip()

    if hasattr(output, "content"):
        content = getattr(output, "content")
        if isinstance(content, str) and content.strip():
            return content.strip()

    if hasattr(output, "as_string"):
        try:
            candidate = output.as_string()
        except Exception:  # pragma: no cover - defensive
            candidate = None
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    return None


def _extract_structured_content(result: Any) -> Iterator[dict[str, Any]]:
    """
    Extract all structured content from Docling conversion result.

    Processes:
    - Document hierarchy (sections, headings)
    - Text blocks with formatting
    - Tables with structure
    - Images with captions
    - Lists and other elements
    """
    document = result.document

    # Iterate through all document items maintaining structure
    for item, level in document.iterate_items():
        try:
            # Get the element type and properties
            element_type = item.__class__.__name__

            # Base metadata
            metadata: dict[str, Any] = {
                "element_type": element_type,
                "hierarchy_level": level,
            }

            if hasattr(item, "prov") and item.prov:
                for prov in item.prov:
                    page_no = getattr(prov, "page_no", None)
                    if page_no is not None:
                        metadata["page"] = page_no
                        break

            if hasattr(item, "label"):
                metadata["label"] = item.label

            text = _coerce_item_text(item)

            if element_type == "TableItem":
                metadata["content_type"] = "table"
                if hasattr(item, "export_to_markdown"):
                    try:
                        text = item.export_to_markdown()
                    except Exception as exc:  # pragma: no cover - defensive
                        logger.debug("docling-table-export-failed", error=str(exc))
                if hasattr(item, "data") and item.data is not None:
                    metadata["table_data"] = _serialize_table(item.data)

            elif element_type == "PictureItem":
                metadata["content_type"] = "image"
                text, picture_metadata = _process_picture_item(item, document, fallback_text=text)
                metadata.update(picture_metadata)

            elif element_type in ("TextItem", "SectionHeaderItem", "ListItem"):
                metadata["content_type"] = "text"

            else:
                metadata["content_type"] = "other"

            if not text or not text.strip():
                continue

            yield {
                "text": text.strip(),
                "metadata": metadata,
            }

        except Exception as exc:
            logger.warning("docling-item-extraction-error", error=str(exc))
            continue


def _coerce_item_text(item: Any) -> str:
    """Return textual representation for the given Docling item."""
    text = ""
    if hasattr(item, "text") and isinstance(item.text, str):
        text = item.text
    elif hasattr(item, "get_text"):
        try:
            candidate = item.get_text()
            if isinstance(candidate, str):
                text = candidate
        except Exception:  # pragma: no cover - defensive
            text = ""
    return text or ""


def _serialize_table(table_data: Any) -> Any:
    """Serialize Docling table data into JSON-friendly structures."""
    if table_data is None:
        return None
    if hasattr(table_data, "model_dump"):
        try:
            return table_data.model_dump()
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("docling-table-serialize-failed", error=str(exc))
    return table_data


def _process_picture_item(
    item: Any, document: Any, *, fallback_text: str
) -> tuple[str, dict[str, Any]]:
    """Build text and metadata for a Docling PictureItem."""
    metadata: dict[str, Any] = {}
    text_parts: list[str] = []

    caption_text = ""
    if hasattr(item, "caption_text"):
        try:
            caption_text = (item.caption_text(document) or "").strip()
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("docling-picture-caption-failed", error=str(exc))
    if not caption_text and hasattr(item, "caption") and isinstance(item.caption, str):
        caption_text = item.caption.strip()

    if caption_text:
        metadata["caption"] = caption_text
        text_parts.append(f"Image caption: {caption_text}")

    image_info = _extract_picture_image_metadata(item, document)
    ocr_text = image_info.get("ocr_text")
    metadata.update(image_info)

    if ocr_text:
        text_parts.append(f"OCR text: {ocr_text}")

    fallback_clean = (fallback_text or "").strip()
    if fallback_clean and fallback_clean.lower() != "[image]":
        text_parts.append(fallback_clean)

    if not text_parts:
        text_parts.append("[Image]")

    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped_parts: list[str] = []
    for part in text_parts:
        if part not in seen:
            seen.add(part)
            deduped_parts.append(part)

    combined_text = "\n\n".join(deduped_parts)
    return combined_text, metadata


def _extract_picture_image_metadata(item: Any, document: Any) -> dict[str, Any]:
    """Extract metadata and OCR text from a Docling PictureItem."""
    metadata: dict[str, Any] = {
        "ocr_used": False,
        "ocr_attempted": False,
    }
    ocr_text: str | None = None

    # Capture lightweight reference data from ImageRef if available
    image_ref = getattr(item, "image", None)
    if image_ref is not None:
        ref_payload: dict[str, Any] = {}
        mimetype = getattr(image_ref, "mimetype", None)
        if isinstance(mimetype, str):
            ref_payload["mimetype"] = mimetype
        dpi = getattr(image_ref, "dpi", None)
        if isinstance(dpi, int):
            ref_payload["dpi"] = dpi
        size = getattr(image_ref, "size", None)
        width = getattr(size, "width", None)
        height = getattr(size, "height", None)
        if isinstance(width, int) and isinstance(height, int):
            ref_payload["dimensions"] = {"width": width, "height": height}
        uri = getattr(image_ref, "uri", None)
        if uri is not None:
            uri_str = str(uri)
            if uri_str.startswith("data:"):
                ref_payload["uri_kind"] = "data"
                ref_payload["uri_length"] = len(uri_str)
            else:
                ref_payload["uri"] = uri_str
        size_bytes = getattr(image_ref, "size", None)
        try:
            if size_bytes is not None:
                ref_payload["size_bytes"] = int(size_bytes)
        except (TypeError, ValueError):
            pass
        if ref_payload:
            metadata["image_ref_info"] = ref_payload

    pil_image = None
    try:
        pil_image = item.get_image(document)
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("docling-picture-get-image-failed", error=str(exc))

    if pil_image is not None:
        image_copy = None
        try:
            image_copy = pil_image.copy()
            width, height = pil_image.size
            metadata["image_dimensions"] = {"width": int(width), "height": int(height)}
            metadata["image_mode"] = str(pil_image.mode)
            try:
                metadata["image_hash"] = hashlib.sha256(pil_image.tobytes()).hexdigest()
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug("docling-picture-hash-failed", error=str(exc))

            if PYTESSERACT_AVAILABLE:
                try:
                    candidate = run_ocr_image(image_copy)
                    candidate = (candidate or "").strip()
                    if candidate:
                        ocr_text = candidate
                        metadata["ocr_used"] = True
                        metadata["ocr_engine"] = "tesseract"
                    metadata["ocr_attempted"] = True
                except Exception as exc:  # pragma: no cover - OCR runtime
                    logger.warning("docling-picture-ocr-error", error=str(exc))
                    metadata["ocr_error"] = str(exc)
                    metadata["ocr_attempted"] = True
            else:
                metadata["ocr_available"] = False
        finally:
            try:
                if image_copy is not None:
                    image_copy.close()
            except Exception:
                pass
            try:
                pil_image.close()
            except Exception:  # pragma: no cover - best effort cleanup
                pass
    else:
        metadata["image_unavailable"] = True

    if ocr_text:
        metadata["ocr_text"] = ocr_text

    return {"ocr_text": ocr_text, **metadata}


def _should_try_excel(path: Path, mime: str | None) -> bool:
    mime_normalized = (mime or "").lower()
    suffix = path.suffix.lower()
    return mime_normalized in EXCEL_MIME_TYPES or suffix in EXCEL_SUFFIXES


def _extract_excel_tables(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Fallback extractor that reads Excel workbooks into CSV-style text."""
    engine = None
    suffix = path.suffix.lower()
    if suffix == ".xls":
        engine = "xlrd"

    try:
        workbook = pd.read_excel(
            path,
            sheet_name=None,
            dtype=str,
            engine=engine,
        )
    except ImportError as exc:  # pragma: no cover - engine missing
        logger.warning("excel-extract-engine-missing", path=str(path), error=str(exc))
        return
    except ValueError as exc:
        # Pandas raises ValueError when the relevant engine is not installed (e.g., xlrd for .xls)
        logger.warning("excel-extract-engine-error", path=str(path), error=str(exc))
        return
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("excel-extract-error", path=str(path), error=str(exc))
        return

    if not workbook:
        return

    chunk_counter = 0

    for sheet_index, (sheet_name, frame) in enumerate(workbook.items()):
        sheet_title = str(sheet_name)
        if frame is None:
            continue
        frame = frame.fillna("")
        if frame.empty and not sheet_title:
            continue

        buffer = io.StringIO()
        try:
            frame.to_csv(buffer, index=False)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning(
                "excel-sheet-export-error", path=str(path), sheet=sheet_title, error=str(exc)
            )
            continue

        text = buffer.getvalue().strip()
        if not text:
            continue

        chunk_counter += 1
        metadata = {
            "content_type": "table",
            "sheet_name": sheet_title,
            "sheet_index": sheet_index,
            "rows": int(frame.shape[0]),
            "columns": int(frame.shape[1]),
        }

        yield DocChunk(
            id=str(uuid4()),
            chunk_id=chunk_counter,
            text=text,
            uri=uri,
            mime=mime,
            source=source,
            metadata=metadata,
        )


def _fallback_pdf_text(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    if path.suffix.lower() == ".pdf":
        try:
            with pdfplumber.open(path) as pdf:
                for idx, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    if not text.strip():
                        continue
                    yield DocChunk(
                        id=str(uuid4()),
                        chunk_id=idx,
                        text=text.strip(),
                        uri=uri,
                        mime=mime,
                        source=source,
                        metadata={"page": idx},
                    )
            return
        except Exception as exc:  # pragma: no cover - pdfplumber runtime errors
            logger.warning("pdfplumber-text-error", path=str(path), error=str(exc))

    # Generic fallback for text-like files.
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1", errors="ignore")
    if text.strip():
        yield DocChunk(
            id=str(uuid4()),
            chunk_id=1,
            text=text.strip(),
            uri=uri,
            mime=mime,
            source=source,
            metadata={},
        )
