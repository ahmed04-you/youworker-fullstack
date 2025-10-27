import { useState, useCallback } from "react";

export function useDocumentSelection() {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());

  const toggleDocument = useCallback((id: number) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedDocuments(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDocuments(new Set());
  }, []);

  const isSelected = useCallback(
    (id: number) => selectedDocuments.has(id),
    [selectedDocuments]
  );

  const selectedCount = selectedDocuments.size;
  const selectedIds = Array.from(selectedDocuments);

  return {
    selectedDocuments,
    selectedIds,
    selectedCount,
    toggleDocument,
    selectAll,
    clearSelection,
    isSelected,
  };
}
