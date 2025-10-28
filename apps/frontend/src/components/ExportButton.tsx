"use client";

import { useState } from "react";
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
import { toast } from "sonner";

interface ExportButtonProps {
  data: any;
  filename?: string;
  formats?: ("json" | "csv" | "txt")[];
  className?: string;
}

export function ExportButton({
  data,
  filename = "export",
  formats = ["json", "csv", "txt"],
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportAsJson = async () => {
    setIsExporting(true);
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      downloadFile(blob, `${filename}.json`);
      toast.success("Exported as JSON");
    } catch (error) {
      toast.error("Failed to export as JSON");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsCsv = async () => {
    setIsExporting(true);
    try {
      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: "text/csv" });
      downloadFile(blob, `${filename}.csv`);
      toast.success("Exported as CSV");
    } catch (error) {
      toast.error("Failed to export as CSV");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsText = async () => {
    setIsExporting(true);
    try {
      const text = convertToText(data);
      const blob = new Blob([text], { type: "text/plain" });
      downloadFile(blob, `${filename}.txt`);
      toast.success("Exported as TXT");
    } catch (error) {
      toast.error("Failed to export as TXT");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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