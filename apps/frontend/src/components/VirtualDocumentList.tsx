"use client";

import { useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DocumentRecord } from "@/lib/types";
import { DocumentPreview } from "@/components/DocumentPreview";
import { Loader2 } from "lucide-react";

interface VirtualDocumentListProps {
  documents: DocumentRecord[];
  isLoading?: boolean;
  onDownload?: (document: DocumentRecord) => void;
  containerHeight?: number;
  itemHeight?: number;
  overscan?: number;
}

export function VirtualDocumentList({
  documents,
  isLoading = false,
  onDownload,
  containerHeight = 600,
  itemHeight = 200,
  overscan = 5,
}: VirtualDocumentListProps) {
  const parentRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);

  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">No documents found</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto rounded-lg border border-border/70 bg-card/50"
      style={{ height: `${containerHeight}px` }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const document = documents[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-4 py-3"
            >
              <DocumentPreview
                document={document}
                onDownload={onDownload}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}