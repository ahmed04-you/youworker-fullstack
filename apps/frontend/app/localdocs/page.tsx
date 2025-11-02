"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AuthPrompt from "../components/AuthPrompt";
import { listDocuments, deleteDocument } from "../../lib/api/documents";
import {
  ingestPath,
  uploadDocuments,
  listIngestionRuns,
  deleteIngestionRun,
} from "../../lib/api/ingestion";
import type { DocumentRecord, IngestionRun } from "../../lib/types";
import { ApiClientError } from "../../lib/api/client";

export default function LocalDocs() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    csrfToken,
    refreshCsrfToken,
  } = useAuth();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([]);

  const [docsLoading, setDocsLoading] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [pathLoading, setPathLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [docsError, setDocsError] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [pathInput, setPathInput] = useState("");
  const [pathTags, setPathTags] = useState("");
  const [fromWeb, setFromWeb] = useState(false);
  const [recursive, setRecursive] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadTags, setUploadTags] = useState("");

  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasLoaded) {
      void Promise.all([refreshDocuments(), refreshIngestionRuns()]);
      setHasLoaded(true);
    }
  }, [authLoading, isAuthenticated, hasLoaded]);

  const parseTags = (value: string) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const ensureCsrfToken = async (): Promise<string> => {
    if (csrfToken) {
      return csrfToken;
    }
    return refreshCsrfToken();
  };

  const refreshDocuments = async () => {
    try {
      setDocsLoading(true);
      setDocsError(null);
      const response = await listDocuments();
      setDocuments(response.documents);
    } catch (err) {
      setDocsError(extractError(err));
    } finally {
      setDocsLoading(false);
    }
  };

  const refreshIngestionRuns = async () => {
    try {
      setRunsLoading(true);
      setRunsError(null);
      const response = await listIngestionRuns({ limit: 25 });
      setIngestionRuns(response.runs);
    } catch (err) {
      setRunsError(extractError(err));
    } finally {
      setRunsLoading(false);
    }
  };

  const handlePathIngest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pathInput.trim()) {
      setFeedback({ type: "error", message: "Please provide a path or URL to ingest." });
      return;
    }

    try {
      setPathLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      const tags = parseTags(pathTags);

      const result = await ingestPath(
        {
          path_or_url: pathInput.trim(),
          from_web: fromWeb,
          recursive,
          tags,
        },
        token
      );

      setFeedback({
        type: "success",
        message: `Ingestion started: processed ${result.files_processed} files (${result.chunks_written} chunks).`,
      });
      setPathInput("");
      setPathTags("");
      setFromWeb(false);
      setRecursive(false);
      await Promise.all([refreshDocuments(), refreshIngestionRuns()]);
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setPathLoading(false);
    }
  };

  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) {
      setFeedback({ type: "error", message: "Select at least one file to upload." });
      return;
    }

    try {
      setUploadLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      const tags = parseTags(uploadTags);

      const filesArray = Array.from(selectedFiles);
      const response = await uploadDocuments(filesArray, {
        tags,
        csrfToken: token,
      });

      setFeedback({
        type: "success",
        message: `Uploaded ${response.files_processed} file(s) · ${response.chunks_written} chunk(s) created.`,
      });
      setSelectedFiles(null);
      setUploadTags("");
      // clear file input manually
      const input = document.getElementById("localdocs-file-input") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      await Promise.all([refreshDocuments(), refreshIngestionRuns()]);
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!window.confirm("Delete this document metadata? This action cannot be undone.")) {
      return;
    }

    try {
      const token = await ensureCsrfToken();
      await deleteDocument(documentId, token);
      setFeedback({ type: "success", message: "Document removed from catalog." });
      await refreshDocuments();
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    }
  };

  const handleDeleteRun = async (runId: number) => {
    if (!window.confirm("Remove this ingestion run from history?")) {
      return;
    }

    try {
      const token = await ensureCsrfToken();
      await deleteIngestionRun(runId, token);
      setFeedback({ type: "success", message: "Ingestion run removed." });
      await refreshIngestionRuns();
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    }
  };

  const totalBytes = useMemo(
    () =>
      documents.reduce((accumulator, doc) => {
        return accumulator + (doc.bytes_size ?? 0);
      }, 0),
    [documents]
  );

  if (!isAuthenticated && !authLoading) {
    return (
      <main className="localdocs-page">
        <div className="auth-wrapper">
          <AuthPrompt
            title="Sign in to manage documents"
            description="Provide a valid Authentik API key to upload and ingest content into your workspace."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="localdocs-page">
      <header className="page-section">
        <div>
          <h1 className="page-title">Local documents</h1>
          <p className="muted-text">
            Import new sources, monitor ingestion runs, and manage indexed documents used by the
            assistant.
          </p>
        </div>
        <div className="inline-stats">
          <span className="badge badge-muted">
            {documents.length} document{documents.length === 1 ? "" : "s"}
          </span>
          <span className="badge badge-info">{formatBytes(totalBytes)}</span>
        </div>
      </header>

      {feedback && (
        <div className={`banner ${feedback.type === "success" ? "banner-success" : "banner-error"}`}>
          {feedback.message}
        </div>
      )}

      <section className="two-column">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Ingest from path or URL</h2>
              <p className="card-subtitle">
                Point the pipeline to a directory within the workspace or crawl a remote URL.
              </p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handlePathIngest}>
            <label className="form-field">
              <span>Path or URL</span>
              <input
                type="text"
                value={pathInput}
                onChange={(event) => setPathInput(event.target.value)}
                placeholder="/home/user/docs or https://example.com"
                required
              />
            </label>
            <label className="form-field">
              <span>Tags (comma separated)</span>
              <input
                type="text"
                value={pathTags}
                onChange={(event) => setPathTags(event.target.value)}
                placeholder="project, roadmap"
              />
            </label>
            <div className="form-switches">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={fromWeb}
                  onChange={(event) => setFromWeb(event.target.checked)}
                />
                <span>Fetch from web (enables crawling)</span>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(event) => setRecursive(event.target.checked)}
                />
                <span>Process directories recursively</span>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={pathLoading}>
              {pathLoading ? "Starting ingestion…" : "Ingest source"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Upload files</h2>
              <p className="card-subtitle">
                Supported formats include PDF, Markdown, CSV, plain text, and common audio assets.
              </p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleFileUpload}>
            <label className="form-field">
              <span>Files</span>
              <input
                id="localdocs-file-input"
                type="file"
                multiple
                onChange={(event) => setSelectedFiles(event.target.files)}
              />
            </label>
            <label className="form-field">
              <span>Tags (comma separated)</span>
              <input
                type="text"
                value={uploadTags}
                onChange={(event) => setUploadTags(event.target.value)}
                placeholder="sales, release-notes"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={uploadLoading}>
              {uploadLoading ? "Uploading…" : "Upload & ingest"}
            </button>
          </form>
        </div>
      </section>

      <section className="card table-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Indexed documents</h2>
            <p className="card-subtitle">
              Metadata for each document stored in the catalog. Removing entries only deletes
              metadata.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => refreshDocuments()} disabled={docsLoading}>
            Refresh
          </button>
        </div>
        {docsError && <div className="banner banner-error">{docsError}</div>}
        {docsLoading ? (
          <div className="loading-state">Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="empty-state">No documents ingested yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Collection</th>
                  <th>Size</th>
                  <th>Tags</th>
                  <th>Created</th>
                  <th>Last ingested</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="ellipsis">{doc.uri || doc.path || "—"}</div>
                      {doc.source && <div className="muted-text-small">{doc.source}</div>}
                    </td>
                    <td>{doc.collection || "default"}</td>
                    <td>{formatBytes(doc.bytes_size)}</td>
                    <td>
                      <div className="tag-list">
                        {(doc.tags ?? []).length === 0 && <span className="muted-text-small">—</span>}
                        {(doc.tags ?? []).map((tag) => (
                          <span className="tag" key={`${doc.id}-${tag}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{formatDateTime(doc.created_at)}</td>
                    <td>{doc.last_ingested_at ? formatDateTime(doc.last_ingested_at) : "—"}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-text"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card table-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Ingestion history</h2>
            <p className="card-subtitle">
              Recent runs with their status, totals, and execution timestamps.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => refreshIngestionRuns()} disabled={runsLoading}>
            Refresh
          </button>
        </div>
        {runsError && <div className="banner banner-error">{runsError}</div>}
        {runsLoading ? (
          <div className="loading-state">Loading ingestion runs…</div>
        ) : ingestionRuns.length === 0 ? (
          <div className="empty-state">No ingestion runs recorded yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Files</th>
                  <th>Chunks</th>
                  <th>Tags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ingestionRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <div>{formatDateTime(run.started_at)}</div>
                      <div className="muted-text-small">
                        {run.finished_at ? `Finished ${formatDateTime(run.finished_at)}` : "In progress"}
                      </div>
                    </td>
                    <td className="ellipsis">{run.target || "—"}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          run.status === "success"
                            ? "status-success"
                            : run.status === "running"
                            ? "status-info"
                            : "status-warning"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td>{run.totals_files ?? 0}</td>
                    <td>{run.totals_chunks ?? 0}</td>
                    <td>
                      <div className="tag-list">
                        {(run.tags ?? []).length === 0 && <span className="muted-text-small">—</span>}
                        {(run.tags ?? []).map((tag) => (
                          <span className="tag" key={`${run.id}-tag-${tag}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-text" onClick={() => handleDeleteRun(run.id)}>
                        Clear
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function extractError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.apiError?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
