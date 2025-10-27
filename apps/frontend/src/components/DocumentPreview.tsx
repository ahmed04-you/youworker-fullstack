"use client";

import { useState } from "react";
import { Download, FileText, Image, Music, Video, File } from "lucide-react";
import { DocumentRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  document: DocumentRecord;
  onDownload?: (document: DocumentRecord) => void;
  className?: string;
}

export function DocumentPreview({
  document,
  onDownload,
  className,
}: DocumentPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);

  const getFileIcon = (mime: string | null) => {
    if (!mime) return <File className="h-8 w-8" />;

    if (mime.startsWith("image/")) {
      return <Image className="h-8 w-8" />;
    } else if (mime.startsWith("audio/")) {
      return <Music className="h-8 w-8" />;
    } else if (mime.startsWith("video/")) {
      return <Video className="h-8 w-8" />;
    } else if (mime.includes("pdf") || mime.includes("document")) {
      return <FileText className="h-8 w-8" />;
    }
    return <File className="h-8 w-8" />;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getFileName = (): string => {
    if (document.path) {
      return document.path.split("/").pop() || "Document";
    }
    if (document.uri) {
      return document.uri.split("/").pop() || "Document";
    }
    return "Document";
  };

  const handleDownload = async () => {
    if (!onDownload) return;
    setIsLoading(true);
    try {
      await onDownload(document);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/50 p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            {getFileIcon(document.mime)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-semibold text-sm text-foreground">
              {getFileName()}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {formatFileSize(document.bytes_size)}
            </p>
          </div>
        </div>
        {onDownload && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            disabled={isLoading}
            className="rounded-full"
            aria-label="Download document"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {document.mime && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline" className="rounded-full">
              {document.mime}
            </Badge>
          </div>
        )}

        {document.collection && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Collection:</span>
            <Badge variant="secondary" className="rounded-full">
              {document.collection}
            </Badge>
          </div>
        )}

        {document.source && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Source:</span>
            <span className="text-foreground">{document.source}</span>
          </div>
        )}

        {document.tags && document.tags.tags && document.tags.tags.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {document.tags.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
          <span className="text-muted-foreground">Created:</span>
          <time dateTime={document.created_at}>
            {new Date(document.created_at).toLocaleDateString()}
          </time>
        </div>

        {document.last_ingested_at && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last ingested:</span>
            <time dateTime={document.last_ingested_at}>
              {new Date(document.last_ingested_at).toLocaleDateString()}
            </time>
          </div>
        )}
      </div>
    </div>
  );
}