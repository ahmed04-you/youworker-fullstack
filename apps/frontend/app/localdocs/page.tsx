"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AuthPrompt from "../components/AuthPrompt";
import { listDocuments, deleteDocument } from "../../lib/api/documents";
import {
  ingestPath,
  uploadDocuments,
} from "../../lib/api/ingestion";
import type { DocumentRecord } from "../../lib/types";
import { ApiClientError } from "../../lib/api/client";

type IngestTab = "files" | "urls";

export default function LocalDocs() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    csrfToken,
    refreshCsrfToken,
  } = useAuth();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);

  const [docsError, setDocsError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<IngestTab>("files");

  // Files tab state
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // URLs tab state
  const [urlInput, setUrlInput] = useState("");

  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasLoaded) {
      void refreshDocuments();
      setHasLoaded(true);
    }
  }, [authLoading, isAuthenticated, hasLoaded]);

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

  const handleFilesTabSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFiles || selectedFiles.length === 0) {
      setFeedback({ type: "error", message: "Please select at least one file to upload." });
      return;
    }

    try {
      setUploadLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();

      const filesArray = Array.from(selectedFiles);
      const response = await uploadDocuments(filesArray, {
        tags: [],
        csrfToken: token,
      });

      setFeedback({
        type: "success",
        message: `Uploaded ${response.files_processed} file(s) · ${response.chunks_written} chunk(s) created.`,
      });
      setSelectedFiles(null);
      // clear file input manually
      const input = document.getElementById("localdocs-file-input") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      await refreshDocuments();
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUrlIngest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!urlInput.trim()) {
      setFeedback({ type: "error", message: "Please provide a URL to ingest." });
      return;
    }

    try {
      setUrlLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();

      const result = await ingestPath(
        {
          path_or_url: urlInput.trim(),
          from_web: true,
          recursive: false, // Only the linked page
          tags: [],
        },
        token
      );

      setFeedback({
        type: "success",
        message: `URL ingested: processed ${result.files_processed} page(s) (${result.chunks_written} chunks).`,
      });
      setUrlInput("");
      await refreshDocuments();
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setUrlLoading(false);
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      const input = document.getElementById("localdocs-file-input") as HTMLInputElement | null;
      if (input) {
        input.files = files;
      }
    }
  };

  const totalBytes = useMemo(
    () =>
      documents.reduce((accumulator, doc) => {
        return accumulator + (doc.bytes_size ?? 0);
      }, 0),
    [documents]
  );

  // Show loading while authenticating
  if (!isAuthenticated && authLoading) {
    return (
      <main className="localdocs-page">
        <div className="card">
          <div className="loading-state">Authenticating...</div>
        </div>
      </main>
    );
  }

  // Show error if authentication failed
  if (!isAuthenticated && !authLoading) {
    return (
      <main className="localdocs-page">
        <AuthPrompt />
      </main>
    );
  }

  return (
    <main className="localdocs-page">
      <header className="page-section">
        <div>
          <h1 className="page-title">Local documents</h1>
          <p className="muted-text">
            Import new sources and manage indexed documents used by the assistant.
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

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Ingest Documents</h2>
            <p className="card-subtitle">
              Upload files or ingest from a URL.
            </p>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            Files
          </button>
          <button
            className={`tab ${activeTab === "urls" ? "active" : ""}`}
            onClick={() => setActiveTab("urls")}
          >
            URLs
          </button>
        </div>

        {activeTab === "files" && (
          <div className="tab-content">
            <form className="form-grid" onSubmit={handleFilesTabSubmit}>
              <div
                className={`dropzone ${isDragging ? "dragging" : ""} ${selectedFiles && selectedFiles.length > 0 ? "has-files" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="dropzone-text">
                  {selectedFiles && selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : "Drag & drop files here or click to browse"}
                </p>
                <label className="btn btn-secondary" style={{ marginTop: '12px' }}>
                  <input
                    id="localdocs-file-input"
                    type="file"
                    multiple
                    onChange={(event) => setSelectedFiles(event.target.files)}
                    style={{ display: 'none' }}
                  />
                  Browse Files
                </label>
              </div>

              <button className="btn btn-primary" type="submit" disabled={uploadLoading} style={{ marginTop: '20px' }}>
                {uploadLoading ? "Processing…" : "Upload & Ingest"}
              </button>
            </form>
          </div>
        )}

        {activeTab === "urls" && (
          <div className="tab-content">
            <form className="form-grid" onSubmit={handleUrlIngest}>
              <label className="form-field">
                <span>URL</span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="https://example.com/page"
                  required
                />
                <span className="form-hint">Only the specified page will be ingested (no crawling)</span>
              </label>
              <button className="btn btn-primary" type="submit" disabled={urlLoading}>
                {urlLoading ? "Ingesting…" : "Ingest URL"}
              </button>
            </form>
          </div>
        )}
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
