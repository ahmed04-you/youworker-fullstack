from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from packages.parsers import ocr_extractor


@pytest.fixture(autouse=True)
def reset_engine(monkeypatch):
    monkeypatch.setattr(ocr_extractor, "_ENGINE", None)


def _make_image(path: Path) -> None:
    image = Image.new("RGB", (32, 32), color=(255, 255, 255))
    image.save(path)
    image.close()


def test_extract_image_uses_configured_engine(monkeypatch, tmp_path):
    class DummyEngine(ocr_extractor.BaseOCREngine):
        name = "dummy"

        def run_image(self, image):
            return ocr_extractor.OCRResult(text="hello world", confidence=0.75)

    dummy = DummyEngine()
    monkeypatch.setattr(ocr_extractor, "_get_engine", lambda: dummy)

    image_path = tmp_path / "image.png"
    _make_image(image_path)

    chunks = list(
        ocr_extractor.extract(
            image_path,
            uri="file://image.png",
            mime="image/png",
            source="image",
        )
    )

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.text == "hello world"
    assert chunk.metadata["ocr_engine"] == "dummy"
    assert chunk.metadata["ocr_used"] is True
    assert chunk.metadata["ocr_confidence"] == pytest.approx(0.75, rel=1e-5)


def test_extract_image_no_text_returns_empty(monkeypatch, tmp_path):
    class EmptyEngine(ocr_extractor.BaseOCREngine):
        name = "empty"

        def run_image(self, image):
            return ocr_extractor.OCRResult(text="")

    monkeypatch.setattr(ocr_extractor, "_get_engine", lambda: EmptyEngine())

    image_path = tmp_path / "empty.png"
    _make_image(image_path)

    chunks = list(
        ocr_extractor.extract(
            image_path,
            uri="file://empty.png",
            mime="image/png",
            source="image",
        )
    )

    assert chunks == []


def test_should_run_ocr_rules():
    chunk = ocr_extractor.DocChunk(
        id="1",
        chunk_id=1,
        text="",
        uri=None,
        mime=None,
        source="file",
        metadata={},
    )
    chunk_with_text = ocr_extractor.DocChunk(
        id="2",
        chunk_id=1,
        text="content",
        uri=None,
        mime=None,
        source="file",
        metadata={},
    )
    assert ocr_extractor.should_run_ocr("image/png", [])
    assert ocr_extractor.should_run_ocr("application/pdf", [chunk])
    assert not ocr_extractor.should_run_ocr("application/pdf", [chunk_with_text])
    assert not ocr_extractor.should_run_ocr("text/plain", [])
