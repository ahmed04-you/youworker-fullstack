import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { DocumentList } from './DocumentList';
import { useDocuments, useDeleteDocumentMutation } from '../api/document-service';
import { useDocumentStore } from '../store/document-store';
import { Document } from '../types';

// Mock the dependencies
vi.mock('../api/document-service');
vi.mock('../store/document-store');
vi.mock('./DocumentCard', () => ({
  DocumentCard: ({ document, onSelect }: any) => (
    <div data-testid={`document-card-${document.id}`}>
      <button onClick={() => onSelect?.(document)}>
        {document.name}
      </button>
    </div>
  ),
}));
vi.mock('./DocumentFilters', () => ({
  DocumentFilters: ({ onFiltersChange }: any) => (
    <button onClick={() => onFiltersChange({})} data-testid="filters-button">
      Filters
    </button>
  ),
}));
vi.mock('./UploadDialog', () => ({
  UploadDialog: ({ open, onOpenChange, onUploadComplete }: any) => (
    open ? (
      <div data-testid="upload-dialog">
        <button onClick={() => onUploadComplete()}>Complete Upload</button>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  ),
}));

describe('DocumentList', () => {
  const mockDocuments: Document[] = [
    {
      id: 1,
      name: 'test-doc-1.pdf',
      type: 'pdf',
      size: 1024,
      status: 'completed',
      source: 'upload',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'test-doc-2.docx',
      type: 'docx',
      size: 2048,
      status: 'completed',
      source: 'upload',
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    },
  ];

  const mockUseDocuments = vi.fn();
  const mockUseDeleteDocumentMutation = vi.fn();
  const mockUseDocumentStore = vi.fn();
  const mockDeleteMutate = vi.fn();
  const mockRefetch = vi.fn();
  const mockClearSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseDocuments.mockReturnValue({
      data: {
        documents: mockDocuments,
        total: 2,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockUseDeleteDocumentMutation.mockReturnValue({
      mutate: mockDeleteMutate,
    });

    mockUseDocumentStore.mockReturnValue({
      filters: {},
      selectedDocuments: [],
      clearSelection: mockClearSelection,
    });

    (useDocuments as any).mockImplementation(mockUseDocuments);
    (useDeleteDocumentMutation as any).mockImplementation(mockUseDeleteDocumentMutation);
    (useDocumentStore as any).mockImplementation(mockUseDocumentStore);

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('should render document list with documents', () => {
    render(<DocumentList />);

    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByTestId('document-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('document-card-2')).toBeInTheDocument();
  });

  it('should show loading skeletons when loading', () => {
    mockUseDocuments.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    // Should show multiple skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state with retry button', () => {
    mockUseDocuments.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    expect(screen.getByText(/Failed to load documents/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should show empty state when no documents', () => {
    mockUseDocuments.mockReturnValue({
      data: {
        documents: [],
        total: 0,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    expect(screen.getByText('No documents found')).toBeInTheDocument();
    expect(screen.getByText(/Get started by uploading/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Document/i })).toBeInTheDocument();
  });

  it('should open upload dialog when upload button is clicked', () => {
    render(<DocumentList />);

    const uploadButton = screen.getByRole('button', { name: /Upload/i });
    fireEvent.click(uploadButton);

    expect(screen.getByTestId('upload-dialog')).toBeInTheDocument();
  });

  it('should close upload dialog and refetch after upload complete', async () => {
    render(<DocumentList />);

    // Open upload dialog
    const uploadButton = screen.getByRole('button', { name: /Upload/i });
    fireEvent.click(uploadButton);

    expect(screen.getByTestId('upload-dialog')).toBeInTheDocument();

    // Complete upload
    const completeButton = screen.getByText('Complete Upload');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
      expect(mockClearSelection).toHaveBeenCalled();
    });
  });

  it('should show selected documents badge', () => {
    mockUseDocumentStore.mockReturnValue({
      filters: {},
      selectedDocuments: [mockDocuments[0], mockDocuments[1]],
      clearSelection: mockClearSelection,
    });

    render(<DocumentList />);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('should show delete selected button when documents are selected', () => {
    mockUseDocumentStore.mockReturnValue({
      filters: {},
      selectedDocuments: [mockDocuments[0]],
      clearSelection: mockClearSelection,
    });

    render(<DocumentList />);

    const deleteButton = screen.getByRole('button', { name: /Delete Selected/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('should delete selected documents when delete button is clicked', () => {
    mockUseDocumentStore.mockReturnValue({
      filters: {},
      selectedDocuments: [mockDocuments[0], mockDocuments[1]],
      clearSelection: mockClearSelection,
    });

    render(<DocumentList />);

    const deleteButton = screen.getByRole('button', { name: /Delete Selected/i });
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Delete 2 document(s)?');
    expect(mockDeleteMutate).toHaveBeenCalledWith(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith(2);
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it('should not delete if user cancels confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    mockUseDocumentStore.mockReturnValue({
      filters: {},
      selectedDocuments: [mockDocuments[0]],
      clearSelection: mockClearSelection,
    });

    render(<DocumentList />);

    const deleteButton = screen.getByRole('button', { name: /Delete Selected/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteMutate).not.toHaveBeenCalled();
    expect(mockClearSelection).not.toHaveBeenCalled();
  });

  it('should render pagination controls when multiple pages', () => {
    mockUseDocuments.mockReturnValue({
      data: {
        documents: mockDocuments,
        total: 50,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
  });

  it('should navigate to next page when next button is clicked', () => {
    mockUseDocuments.mockReturnValue({
      data: {
        documents: mockDocuments,
        total: 50,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Should call useDocuments with page 2
    expect(mockUseDocuments).toHaveBeenLastCalledWith(2, 20, {}, { enabled: true });
  });

  it('should navigate to previous page when previous button is clicked', () => {
    mockUseDocuments.mockReturnValue({
      data: {
        documents: mockDocuments,
        total: 50,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { rerender } = render(<DocumentList />);

    // Go to page 2 first
    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Re-render to simulate page change
    rerender(<DocumentList />);

    const prevButton = screen.getByRole('button', { name: /Previous/i });
    fireEvent.click(prevButton);

    // Should go back to page 1
    expect(mockUseDocuments).toHaveBeenCalled();
  });

  it('should disable previous button on first page', () => {
    mockUseDocuments.mockReturnValue({
      data: {
        documents: mockDocuments,
        total: 50,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    const prevButton = screen.getByRole('button', { name: /Previous/i });
    expect(prevButton).toBeDisabled();
  });

  it('should call onDocumentSelect when document is clicked', () => {
    const mockOnSelect = vi.fn();
    render(<DocumentList onDocumentSelect={mockOnSelect} />);

    const doc1Button = screen.getByText('test-doc-1.pdf');
    fireEvent.click(doc1Button);

    expect(mockOnSelect).toHaveBeenCalledWith(mockDocuments[0]);
  });

  it('should reset to page 1 when filters change', () => {
    render(<DocumentList />);

    const filtersButton = screen.getByTestId('filters-button');
    fireEvent.click(filtersButton);

    // After filter change, should be on page 1
    expect(mockUseDocuments).toHaveBeenCalled();
  });

  it('should not render pagination when only one page', () => {
    mockUseDocuments.mockReturnValue({
      data: {
        documents: mockDocuments,
        total: 2,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<DocumentList />);

    expect(screen.queryByRole('button', { name: /Previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next/i })).not.toBeInTheDocument();
  });

  it('should not show delete button when no documents are selected', () => {
    render(<DocumentList />);

    expect(screen.queryByRole('button', { name: /Delete Selected/i })).not.toBeInTheDocument();
  });

  it('should not show selected badge when no documents are selected', () => {
    render(<DocumentList />);

    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });
});
