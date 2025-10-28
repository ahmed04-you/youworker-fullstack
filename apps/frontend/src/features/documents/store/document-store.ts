import { create } from 'zustand';
import { Document, DocumentFilters } from '../types';

interface DocumentState {
  selectedDocuments: Document[];
  filters: DocumentFilters;
  setSelectedDocuments: (documents: Document[]) => void;
  toggleDocumentSelection: (document: Document) => void;
  clearSelection: () => void;
  setFilters: (filters: DocumentFilters) => void;
  resetFilters: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  selectedDocuments: [],
  filters: {},
  setSelectedDocuments: (documents) => set({ selectedDocuments: documents }),
  toggleDocumentSelection: (document) =>
    set((state) => ({
      selectedDocuments: state.selectedDocuments.some((d) => d.id === document.id)
        ? state.selectedDocuments.filter((d) => d.id !== document.id)
        : [...state.selectedDocuments, document],
    })),
  clearSelection: () => set({ selectedDocuments: [] }),
  setFilters: (filters) => set({ filters }),
  resetFilters: () => set({ filters: {} }),
}));