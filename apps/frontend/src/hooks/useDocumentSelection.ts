import { useState, useCallback } from "react";

/**
 * Hook for managing multi-select document selection state.
 * Provides utilities for toggling, selecting all, and clearing document selections.
 *
 * @returns Object containing:
 *  - selectedDocuments: Set of selected document IDs
 *  - selectedIds: Array of selected document IDs
 *  - selectedCount: Number of selected documents
 *  - toggleDocument: Toggle selection state of a document
 *  - selectAll: Select all documents by their IDs
 *  - clearSelection: Clear all selections
 *  - isSelected: Check if a document is selected
 *
 * @example
 * ```tsx
 * const { selectedIds, selectedCount, toggleDocument, selectAll, clearSelection } = useDocumentSelection();
 *
 * return (
 *   <>
 *     <button onClick={() => selectAll(documents.map(d => d.id))}>Select All</button>
 *     <button onClick={clearSelection}>Clear</button>
 *     <p>{selectedCount} selected</p>
 *     {documents.map(doc => (
 *       <Checkbox key={doc.id} checked={isSelected(doc.id)} onChange={() => toggleDocument(doc.id)} />
 *     ))}
 *   </>
 * );
 * ```
 */
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
