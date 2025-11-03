import asyncio
from pathlib import Path

import pytest

from packages.ingestion.pipeline import IngestionPipeline
from packages.parsers.models import DocChunk, IngestionItem


@pytest.fixture
def pipeline_factory(monkeypatch):
    def _create_pipeline():
        holder: dict[str, list[dict]] = {}

        async def fake_embed_chunks(chunks, _embedder):
            holder["chunks"] = list(chunks)
            return [[float(idx)] for idx, _ in enumerate(chunks)]

        async def fake_prepare_points(chunks, vectors, _settings, collection_name=None):
            holder["metadata"] = [dict(chunk.metadata) for chunk in chunks]
            holder["vectors"] = list(vectors)
            return [
                {"id": chunk.id, "vector": vector, "payload": chunk.metadata}
                for chunk, vector in zip(chunks, vectors, strict=True)
            ]

        async def fake_upsert(points, *_args, **_kwargs):
            holder["points"] = list(points)

        monkeypatch.setattr("packages.ingestion.pipeline.embed_chunks", fake_embed_chunks)
        monkeypatch.setattr("packages.ingestion.pipeline.prepare_points", fake_prepare_points)
        monkeypatch.setattr("packages.ingestion.pipeline.upsert_embedded_chunks", fake_upsert)
        monkeypatch.setattr("packages.ingestion.pipeline.ensure_collections", lambda *a, **k: None)
        monkeypatch.setattr("packages.ingestion.pipeline.get_client", lambda settings: object())

        pipeline = IngestionPipeline()
        monkeypatch.setattr(pipeline, "_get_embedder", lambda: object())
        return pipeline, holder

    return _create_pipeline


@pytest.mark.asyncio
async def test_process_item_retains_table_metadata(monkeypatch, pipeline_factory, tmp_path):
    pipeline, holder = pipeline_factory()

    def fake_docling_extract(path, uri, mime, source):
        return iter(
            [
                DocChunk(
                    id="table-1",
                    chunk_id=1,
                    text="| A | B |\n| 1 | 2 |",
                    uri=uri,
                    mime=mime,
                    source=source,
                    metadata={
                        "content_type": "table",
                        "table_data": {"rows": [["A", "B"], ["1", "2"]]},
                        "page": 1,
                    },
                )
            ]
        )

    monkeypatch.setattr("packages.ingestion.pipeline.docling_extract", fake_docling_extract)
    monkeypatch.setattr("packages.ingestion.pipeline.table_extract", lambda *a, **k: iter(()))
    monkeypatch.setattr("packages.ingestion.pipeline.should_run_ocr", lambda *_: False)
    monkeypatch.setattr("packages.ingestion.pipeline.ocr_extract", lambda *a, **k: iter(()))

    item = IngestionItem(
        path=tmp_path / "table.pdf",
        uri="file:///table.pdf",
        mime="application/pdf",
        bytes_size=128,
    )

    stats = await pipeline._process_item(item, tags=["finance"], from_web=False, collection_name=None, user_id=7)

    assert stats.chunk_count == 1
    assert stats.artifact_summary["counts"]["tables"] == 1
    chunk_metadata = holder["metadata"][0]
    assert chunk_metadata["content_type"] == "table"
    assert "table_data" in chunk_metadata
    assert chunk_metadata["artifact_summary"]["tables"] == 1
    assert "finance" in chunk_metadata.get("tags", [])


@pytest.mark.asyncio
async def test_process_item_adds_table_fallback(monkeypatch, pipeline_factory, tmp_path):
    pipeline, holder = pipeline_factory()

    def fake_docling_extract(path, uri, mime, source):
        return iter(
            [
                DocChunk(
                    id="doc-1",
                    chunk_id=1,
                    text="Quarterly report summary.",
                    uri=uri,
                    mime=mime,
                    source=source,
                    metadata={
                        "content_type": "text",
                        "page": 1,
                    },
                )
            ]
        )

    def fake_table_extract(path, uri, mime, source):
        return iter(
            [
                DocChunk(
                    id="tbl-1",
                    chunk_id=1,
                    text="Revenue,Amount\nQ1,1000",
                    uri=uri,
                    mime=mime,
                    source=source,
                    metadata={
                        "content_type": "table",
                        "table": {"rows": [["Revenue", "Amount"], ["Q1", "1000"]]},
                        "page": 2,
                    },
                )
            ]
        )

    monkeypatch.setattr("packages.ingestion.pipeline.docling_extract", fake_docling_extract)
    monkeypatch.setattr("packages.ingestion.pipeline.table_extract", fake_table_extract)
    monkeypatch.setattr("packages.ingestion.pipeline.should_run_ocr", lambda *_: False)
    monkeypatch.setattr("packages.ingestion.pipeline.ocr_extract", lambda *a, **k: iter(()))

    item = IngestionItem(
        path=tmp_path / "report.pdf",
        uri="file:///report.pdf",
        mime="application/pdf",
        bytes_size=256,
    )

    stats = await pipeline._process_item(item, tags=[], from_web=False, collection_name=None, user_id=3)

    assert stats.chunk_count == 2
    assert stats.artifact_summary["counts"]["tables"] == 1
    table_chunks = [meta for meta in holder["metadata"] if meta.get("content_type") == "table"]
    assert table_chunks, "Expected fallback table chunk to be ingested"
    assert table_chunks[0]["table"]


@pytest.mark.asyncio
async def test_fetch_web_resources_downloads_embedded_assets(monkeypatch, pipeline_factory):
    pipeline, _ = pipeline_factory()

    class FakeResponse:
        def __init__(self, *, text="", content=b"", url="", headers=None):
            self.text = text
            self.content = content
            self.url = url
            self.headers = headers or {}

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            if url == "https://example.com":
                return FakeResponse(
                    text="<html><body><img src='/files/chart.png'></body></html>",
                    url=url,
                )
            if url == "https://example.com/files/chart.png":
                return FakeResponse(
                    content=b"\x89PNGDATA",
                    url=url,
                    headers={"content-type": "image/png"},
                )
            raise AssertionError(f"Unexpected URL requested: {url}")

    monkeypatch.setattr("httpx.AsyncClient", FakeAsyncClient)

    items = await pipeline._fetch_web_resources("https://example.com")
    pipeline._cleanup_temp_dirs()

    assert len(items) == 2
    html_item, asset_item = items
    assert html_item.mime == "text/html"
    assert asset_item.mime == "image/png"
    assert asset_item.uri == "https://example.com/files/chart.png"
    assert asset_item.bytes_size == len(b"\x89PNGDATA")
