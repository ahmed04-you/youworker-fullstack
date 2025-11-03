"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AuthPrompt from "../components/AuthPrompt";
import {
  getOverviewMetrics,
  getToolPerformance,
  getSessionActivity,
  getIngestionStats,
  listToolRuns,
} from "../../lib/api/analytics";
import type {
  OverviewMetrics,
  ToolPerformanceResponse,
  SessionActivityResponse,
  IngestionStatsResponse,
  ToolRunListResponse,
} from "../../lib/types";

const DEFAULT_WINDOW_DAYS = 30;

export default function Analytics() {
  const { isAuthenticated, isLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [toolPerformance, setToolPerformance] = useState<ToolPerformanceResponse | null>(null);
  const [sessionActivity, setSessionActivity] = useState<SessionActivityResponse | null>(null);
  const [ingestionStats, setIngestionStats] = useState<IngestionStatsResponse | null>(null);
  const [toolRuns, setToolRuns] = useState<ToolRunListResponse | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasLoaded) {
      void loadDashboard();
    }
  }, [isLoading, isAuthenticated, hasLoaded]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        toolPerfData,
        sessionActivityData,
        ingestionStatsData,
        toolRunsData,
      ] = await Promise.all([
        getOverviewMetrics(DEFAULT_WINDOW_DAYS),
        getToolPerformance(DEFAULT_WINDOW_DAYS),
        getSessionActivity(DEFAULT_WINDOW_DAYS),
        getIngestionStats(DEFAULT_WINDOW_DAYS),
        listToolRuns({ limit: 10 }),
      ]);

      setOverview(overviewData);
      setToolPerformance(toolPerfData);
      setSessionActivity(sessionActivityData);
      setIngestionStats(ingestionStatsData);
      setToolRuns(toolRunsData);
      setHasLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load analytics";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const recentSessionEntries = useMemo(
    () => (sessionActivity?.timeline ?? []).slice(-6).reverse(),
    [sessionActivity]
  );

  const recentIngestionEntries = useMemo(
    () => (ingestionStats?.timeline ?? []).slice(-6).reverse(),
    [ingestionStats]
  );

  // Show loading while authenticating
  if (!isAuthenticated && isLoading) {
    return (
      <main className="dashboard-page">
        <div className="card">
          <div className="loading-state">Authenticating...</div>
        </div>
      </main>
    );
  }

  // Show login prompt if authentication required
  if (!isAuthenticated && !isLoading) {
    return (
      <main className="dashboard-page">
        <AuthPrompt />
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="muted-text">
            Key activity across chat sessions, tools, and document ingestion over the past{" "}
            {overview?.period_days ?? DEFAULT_WINDOW_DAYS} days.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => loadDashboard()} disabled={loading}>
          Refresh
        </button>
      </header>

      {error && <div className="banner banner-error">{error}</div>}

      {loading && (
        <div className="card">
          <div className="loading-state">Loading latest analytics…</div>
        </div>
      )}

      {!loading && (
        <>
          <section className="dashboard-grid">
            <MetricCard
              title="Sessions"
              primary={formatNumber(overview?.sessions.total)}
              secondary={`Avg / day: ${formatNumber(overview?.sessions.avg_per_day, 1)}`}
              icon="💬"
            />
            <MetricCard
              title="Messages"
              primary={formatNumber(overview?.messages.total)}
              secondary={`Avg / session: ${formatNumber(overview?.messages.avg_per_session, 1)}`}
              icon="✉️"
            />
            <MetricCard
              title="Tool runs"
              primary={formatNumber(overview?.tools.total_runs)}
              secondary={`Success rate: ${formatPercent(overview?.tools.success_rate)}`}
              icon="🛠️"
            />
            <MetricCard
              title="Documents"
              primary={formatNumber(overview?.documents.total)}
              secondary="Ingested across all collections"
              icon="📄"
            />
            <MetricCard
              title="Ingestion runs"
              primary={formatNumber(overview?.ingestion.total_runs)}
              secondary="Successful imports tracked"
              icon="⬆️"
            />
          </section>

          <section className="two-column">
            <div className="card table-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Tool performance</h2>
                  <p className="card-subtitle">
                    Aggregated results sorted by total executions.
                  </p>
                </div>
              </div>
              {toolPerformance?.data.length ? (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tool</th>
                        <th>Runs</th>
                        <th>Success</th>
                        <th>Avg latency</th>
                        <th>Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toolPerformance.data.map((tool) => (
                        <tr key={tool.tool_name}>
                          <td>{tool.tool_name}</td>
                          <td>{formatNumber(tool.total_runs)}</td>
                          <td>{formatPercent(tool.success_rate)}</td>
                          <td>{formatLatency(tool.avg_latency_ms)}</td>
                          <td>
                            {formatLatency(tool.min_latency_ms)} – {formatLatency(tool.max_latency_ms)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No tool activity captured yet.</div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Session activity</h2>
                  <p className="card-subtitle">
                    Daily session creation and tool usage toggles by model.
                  </p>
                </div>
              </div>
              <div className="timeline-list">
                {recentSessionEntries.length === 0 && (
                  <div className="empty-state">No sessions recorded lately.</div>
                )}
                {recentSessionEntries.map((entry) => (
                  <div key={entry.period} className="timeline-item">
                    <div>
                      <h3>{formatDate(entry.period)}</h3>
                      <p className="muted-text">
                        {formatNumber(entry.session_count)} sessions
                      </p>
                    </div>
                    <div className="timeline-values">
                      <span className="badge badge-success">
                        Tools on {formatPercent(entry.tools_enabled_rate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="model-badges">
                {(sessionActivity?.by_model ?? []).map((model) => (
                  <span key={model.model} className="badge badge-muted">
                    {model.model ?? "unknown"} · {formatNumber(model.session_count)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="two-column">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Ingestion timeline</h2>
                  <p className="card-subtitle">
                    Track bulk imports and their success rates.
                  </p>
                </div>
              </div>
              <div className="timeline-list">
                {recentIngestionEntries.length === 0 && (
                  <div className="empty-state">No ingestion runs executed yet.</div>
                )}
                {recentIngestionEntries.map((entry) => (
                  <div key={entry.period} className="timeline-item">
                    <div>
                      <h3>{formatDate(entry.period)}</h3>
                      <p className="muted-text">
                        {formatNumber(entry.run_count)} runs · {formatNumber(entry.total_files)} files
                      </p>
                    </div>
                    <div className="timeline-values">
                      <span className="badge badge-info">
                        {formatNumber(entry.total_chunks)} chunks
                      </span>
                      <span className="badge badge-success">
                        Success {formatPercent(entry.success_rate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card table-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Top collections</h2>
                  <p className="card-subtitle">
                    Storage footprint by collection across all documents.
                  </p>
                </div>
              </div>
              {(ingestionStats?.by_collection?.length ?? 0) > 0 ? (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Collection</th>
                        <th>Documents</th>
                        <th>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ingestionStats?.by_collection ?? []).map((collection) => (
                        <tr key={collection.collection}>
                          <td>{collection.collection}</td>
                          <td>{formatNumber(collection.document_count)}</td>
                          <td>{formatBytes(collection.total_bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No collections have been populated yet.</div>
              )}
            </div>
          </section>

          <section className="card table-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Recent tool executions</h2>
                <p className="card-subtitle">
                  Live feed of the latest tool invocations across sessions.
                </p>
              </div>
            </div>
            {(toolRuns?.runs.length ?? 0) > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Started</th>
                      <th>Tool</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(toolRuns?.runs ?? []).map((run) => {
                      const statusClass =
                        run.status === "success"
                          ? "status-success"
                          : run.status === "error"
                          ? "status-error"
                          : "status-warning";

                      return (
                        <tr key={run.id}>
                          <td>{formatDateTime(run.start_ts)}</td>
                          <td>{run.tool_name}</td>
                          <td>
                            <span className={`status-badge ${statusClass}`}>
                              {run.status}
                            </span>
                          </td>
                          <td>{formatLatency(run.latency_ms)}</td>
                          <td className="ellipsis">
                            {typeof run.result_preview === "string"
                              ? run.result_preview
                              : run.result_preview
                              ? JSON.stringify(run.result_preview).slice(0, 80)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No tool runs captured in this window.</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({
  title,
  primary,
  secondary,
  icon,
}: {
  title: string;
  primary: string;
  secondary: string;
  icon: string;
}) {
  return (
    <div className="card metric-card">
      <div className="metric-icon" aria-hidden>{icon}</div>
      <div>
        <h2 className="card-title">{title}</h2>
        <div className="metric-primary">{primary}</div>
        <div className="metric-secondary">{secondary}</div>
      </div>
    </div>
  );
}

function formatNumber(value: number | undefined, digits = 0): string {
  const safeValue = value ?? 0;
  return Number.isFinite(safeValue) ? safeValue.toLocaleString(undefined, { maximumFractionDigits: digits }) : "0";
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "0%";
  }
  return `${value.toFixed(1)}%`;
}

function formatLatency(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "—";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${Math.round(value)} ms`;
}

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
