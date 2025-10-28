import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadDialog } from './UploadDialog';
import { useDocumentUpload } from '../hooks/useDocumentUpload';

// Mock the document upload hook
vi.mock('../hooks/useDocumentUpload', () => ({
  useDocumentUpload: vi.fn(),
}));

describe('UploadDialog', () => {
  const mockHandleFileSelect = vi.fn();
  const mockHandleDrop = vi.fn();
  const mockHandleDragOver = vi.fn();
  const mockHandleDragLeave = vi.fn();
  const mockRemoveFile = vi.fn();
  const mockUpload = vi.fn();
  const mockGetProgress = vi.fn();
  const mockOnOpenChange = vi.fn();
  const mockOnUploadComplete = vi.fn();

  const defaultHookReturn = {
    files: [],
    dragging: false,
    isUploading: false,
    getProgress: mockGetProgress,
    handleFileSelect: mockHandleFileSelect,
    handleDrop: mockHandleDrop,
    handleDragOver: mockHandleDragOver,
    handleDragLeave: mockHandleDragLeave,
    removeFile: mockRemoveFile,
    upload: mockUpload,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProgress.mockReturnValue(0);
  });

  it('renders upload dialog with trigger button', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={false} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByRole('button', { name: /upload documents/i })).toBeInTheDocument();
  });

  it('displays tooltip on trigger button', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={false} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const button = screen.getByRole('button', { name: /upload documents/i });
    fireEvent.mouseOver(button);

    waitFor(() => {
      expect(screen.getByText(/Upload documents to use in chat/i)).toBeInTheDocument();
    });
  });

  it('displays dialog content when open', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
    expect(screen.getByText('Drop files here or click to browse')).toBeInTheDocument();
  });

  it('displays supported file types in description', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText(/Supports PDF, TXT, CSV, JSON, PNG, JPEG, MP3, WAV/i)).toBeInTheDocument();
  });

  it('highlights drop zone when dragging files', () => {
    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      dragging: true,
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const dropZone = container.querySelector('.border-primary');
    expect(dropZone).toBeInTheDocument();
  });

  it('does not highlight drop zone when not dragging', () => {
    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      dragging: false,
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const dropZone = container.querySelector('.border-muted');
    expect(dropZone).toBeInTheDocument();
  });

  it('calls handleFileSelect when files are selected', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const fileInput = screen.getByLabelText('Select Files').previousElementSibling as HTMLInputElement;
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockHandleFileSelect).toHaveBeenCalledWith([file]);
  });

  it('calls handleDrop when files are dropped', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const dropZone = screen.getByRole('button', { name: /drop files here/i });
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const dropEvent = { dataTransfer: { files: [file] } };

    fireEvent.drop(dropZone, dropEvent);

    expect(mockHandleDrop).toHaveBeenCalled();
  });

  it('calls handleDragOver when dragging over drop zone', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const dropZone = screen.getByRole('button', { name: /drop files here/i });

    fireEvent.dragOver(dropZone);

    expect(mockHandleDragOver).toHaveBeenCalled();
  });

  it('calls handleDragLeave when leaving drop zone', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const dropZone = screen.getByRole('button', { name: /drop files here/i });

    fireEvent.dragLeave(dropZone);

    expect(mockHandleDragLeave).toHaveBeenCalled();
  });

  it('displays selected files', () => {
    const files = [
      new File(['hello'], 'test1.txt', { type: 'text/plain' }),
      new File(['world'], 'test2.pdf', { type: 'application/pdf' }),
    ];
    Object.defineProperty(files[0], 'size', { value: 1024 * 1024 }); // 1 MB
    Object.defineProperty(files[1], 'size', { value: 2 * 1024 * 1024 }); // 2 MB

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files,
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText('test1.txt')).toBeInTheDocument();
    expect(screen.getByText('test2.pdf')).toBeInTheDocument();
    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
  });

  it('displays file sizes correctly', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 1536 * 1024 }); // 1.5 MB

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText('1.5 MB')).toBeInTheDocument();
  });

  it('calls removeFile when remove button is clicked', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const removeButtons = screen.getAllByRole('button');
    const removeButton = removeButtons.find(btn =>
      btn.querySelector('svg.lucide-x')
    );

    if (removeButton) {
      fireEvent.click(removeButton);
      expect(mockRemoveFile).toHaveBeenCalledWith(file);
    }
  });

  it('disables remove button during upload', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
      isUploading: true,
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const removeButtons = screen.getAllByRole('button');
    const removeButton = removeButtons.find(btn =>
      btn.querySelector('svg.lucide-x')
    );

    expect(removeButton).toBeDisabled();
  });

  it('displays upload button with file count', () => {
    const files = [
      new File(['hello'], 'test1.txt', { type: 'text/plain' }),
      new File(['world'], 'test2.txt', { type: 'text/plain' }),
    ];

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files,
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByRole('button', { name: /upload 2 files/i })).toBeInTheDocument();
  });

  it('displays singular form for single file', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByRole('button', { name: /upload 1 file$/i })).toBeInTheDocument();
  });

  it('calls upload when upload button is clicked', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const uploadButton = screen.getByRole('button', { name: /upload 1 file/i });
    fireEvent.click(uploadButton);

    expect(mockUpload).toHaveBeenCalled();
  });

  it('disables upload button when no files are selected', () => {
    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [],
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    // No upload button should be visible when files array is empty
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });

  it('shows uploading state', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
      isUploading: true,
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('disables upload button during upload', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
      isUploading: true,
    });

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const uploadButton = screen.getByRole('button', { name: /uploading/i });
    expect(uploadButton).toBeDisabled();
  });

  it('displays upload progress bar', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    mockGetProgress.mockReturnValue(50);

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
      isUploading: true,
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const progressBar = container.querySelector('.bg-primary.h-2');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('hides progress bar when progress is 0', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    mockGetProgress.mockReturnValue(0);

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const progressBarContainer = container.querySelector('.w-20.bg-muted');
    expect(progressBarContainer).not.toBeInTheDocument();
  });

  it('renders file input with accept attribute', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('accept');
    expect(fileInput.accept).toContain('application/pdf');
    expect(fileInput.accept).toContain('text/plain');
  });

  it('renders file input with multiple attribute', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('multiple');
  });

  it('displays upload icon in drop zone', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const uploadIcon = container.querySelector('svg.lucide-upload');
    expect(uploadIcon).toBeInTheDocument();
  });

  it('displays file icon for each file in list', () => {
    const files = [
      new File(['hello'], 'test1.txt', { type: 'text/plain' }),
      new File(['world'], 'test2.txt', { type: 'text/plain' }),
    ];

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files,
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const fileIcons = container.querySelectorAll('svg.lucide-file');
    expect(fileIcons.length).toBe(2);
  });

  it('displays spinner icon during upload', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files: [file],
      isUploading: true,
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const spinner = container.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('passes onUploadComplete to useDocumentUpload', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    expect(useDocumentUpload).toHaveBeenCalledWith({ onUploadComplete: mockOnUploadComplete });
  });

  it('has scrollable file list with max height', () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      new File(['test'], `file${i}.txt`, { type: 'text/plain' })
    );

    vi.mocked(useDocumentUpload).mockReturnValue({
      ...defaultHookReturn,
      files,
    });

    const { container } = render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const fileList = container.querySelector('.max-h-40.overflow-y-auto');
    expect(fileList).toBeInTheDocument();
  });

  it('renders drop zone with keyboard accessibility', () => {
    vi.mocked(useDocumentUpload).mockReturnValue(defaultHookReturn);

    render(<UploadDialog open={true} onOpenChange={mockOnOpenChange} onUploadComplete={mockOnUploadComplete} />);

    const dropZone = screen.getByRole('button', { name: /drop files here/i });
    expect(dropZone).toHaveAttribute('tabIndex', '0');
  });
});
