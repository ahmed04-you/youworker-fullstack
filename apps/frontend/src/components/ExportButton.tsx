"use client";

import { memo, useCallback, useState } from "react";
import { Download, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

interface ExportButtonProps {
  data: any;
  filename?: string;
  formats?: ("json" | "csv" | "txt")[];
  className?: string;
}

function ExportButtonComponent({
  data,
  filename = "export",
  formats = ["json", "csv", "txt"],
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const downloadFile = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const exportAsJson = useCallback(async () => {
    setIsExporting(true);
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      downloadFile(blob, `${filename}.json`);
      toastSuccess("Exported as JSON");
    } catch (error) {
      toastError("Failed to export as JSON");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, downloadFile]);

  const exportAsCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: "text/csv" });
      downloadFile(blob, `${filename}.csv`);
      toastSuccess("Exported as CSV");
    } catch (error) {
      toastError("Failed to export as CSV");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, downloadFile]);

  const exportAsText = useCallback(async () => {
    setIsExporting(true);
    try {
      const text = convertToText(data);
      const blob = new Blob([text], { type: "text/plain" });
      downloadFile(blob, `${filename}.txt`);
      toastSuccess("Exported as TXT");
    } catch (error) {
      toastError("Failed to export as TXT");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, downloadFile]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isExporting}
              className={className}
              aria-label="Export data"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export data in JSON, CSV, or TXT format</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {formats.includes("json") && (
          <DropdownMenuItem onClick={exportAsJson} disabled={isExporting}>
            <FileJson className="mr-2 h-4 w-4" />
            Export as JSON
          </DropdownMenuItem>
        )}
        {formats.includes("csv") && (
          <DropdownMenuItem onClick={exportAsCsv} disabled={isExporting}>
            <FileText className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
        )}
        {formats.includes("txt") && (
          <DropdownMenuItem onClick={exportAsText} disabled={isExporting}>
            <FileText className="mr-2 h-4 w-4" />
            Export as TXT
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

ExportButtonComponent.displayName = 'ExportButton';

export const ExportButton = memo(ExportButtonComponent);

function convertToCSV(data: any): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const rows = data.map((item) =>
      headers.map((header) => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
    );

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  return JSON.stringify(data);
}

function convertToText(data: any): string {
  if (Array.isArray(data)) {
    return data
      .map((item, index) => {
        if (typeof item === "object") {
          return `Item ${index + 1}:\n${Object.entries(item)
            .map(([key, value]) => `  ${key}: ${value}`)
            .join("\n")}`;
        }
        return `${index + 1}. ${item}`;
      })
      .join("\n\n");
  }

  if (typeof data === "object") {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");
  }

  return String(data);
}
