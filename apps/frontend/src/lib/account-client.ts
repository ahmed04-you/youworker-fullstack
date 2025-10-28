import { apiDelete, apiPost, ApiError } from "./api-client";

export interface HistorySummary {
  sessions_deleted: number;
  messages_deleted: number;
}

export interface AccountExportResult {
  blob: Blob;
  filename: string;
}

function parseFilename(header: string | null): string {
  if (!header) {
    return `youworker-export-${Date.now()}.json`;
  }

  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/["']/g, "").trim());
    } catch {
      return match[1].replace(/["']/g, "").trim();
    }
  }

  return `youworker-export-${Date.now()}.json`;
}

export async function rotateApiKey(): Promise<string> {
  const response = await apiPost<{ api_key: string }>("/v1/account/api-key/rotate");
  return response.api_key;
}

export async function clearChatHistory(): Promise<HistorySummary> {
  return apiDelete<HistorySummary>("/v1/account/history");
}

export async function deleteAccount(): Promise<void> {
  await apiDelete("/v1/account");
}

export async function downloadAccountExport(): Promise<AccountExportResult> {
  const response = await fetch("/v1/account/export", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = undefined;
    }
    throw new ApiError(
      `Export request failed with status ${response.status}`,
      response.status,
      details
    );
  }

  const blob = await response.blob();
  const filename = parseFilename(response.headers.get("Content-Disposition"));

  return { blob, filename };
}
