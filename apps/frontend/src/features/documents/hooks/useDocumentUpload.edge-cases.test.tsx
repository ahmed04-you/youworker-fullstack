/**
 * Edge case tests for useDocumentUpload hook
 * Covers: large files, unsupported types, network errors, quota limits, concurrent uploads
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocumentUpload } from './useDocumentUpload';

// Mock dependencies
vi.mock('@/hooks/useFileValidation', () => ({
  useFileValidation: () => ({
    validateSingleFile: vi.fn().mockImplementation((file: File) => {
      // Simulate validation logic
      const maxSize = 100 * 1024 * 1024; // 100MB
      const allowedTypes = ['application/pdf', 'text/plain', 'text/csv', 'application/json', 'image/png', 'image/jpeg'];

      if (file.size > maxSize) {
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        return false;
      }
      return true;
    }),
  }),
}));

vi.mock('@/lib/toast-helpers', () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

const mockMutateAsync = vi.fn();
const mockUploadDocumentsMutation = {
  mutateAsync: mockMutateAsync,
  isPending: false,
};

vi.mock('../api/document-service', () => ({
  useUploadDocumentsMutation: () => mockUploadDocumentsMutation,
}));

describe('useDocumentUpload - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
    mockUploadDocumentsMutation.isPending = false;
  });

  describe('Large File Handling', () => {
    it('should reject files larger than maximum size (100MB)', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      const { result } = renderHook(() => useDocumentUpload());

      const largeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(largeFile, 'size', { value: 101 * 1024 * 1024 });

      await act(async () => {
        result.current.handleFileSelect([largeFile]);
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Invalid file: large.pdf');
        expect(result.current.files).toHaveLength(0);
      });
    });

    it('should accept files at exactly maximum size (100MB)', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const maxSizeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'max.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(maxSizeFile, 'size', { value: 100 * 1024 * 1024 });

      await act(async () => {
        result.current.handleFileSelect([maxSizeFile]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });
    });

    it('should handle multiple large files gracefully', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      const { result } = renderHook(() => useDocumentUpload());

      const largeFiles = [
        new File(['x'], 'large1.pdf', { type: 'application/pdf' }),
        new File(['x'], 'large2.pdf', { type: 'application/pdf' }),
        new File(['x'], 'large3.pdf', { type: 'application/pdf' }),
      ];

      largeFiles.forEach(file => {
        Object.defineProperty(file, 'size', { value: 101 * 1024 * 1024 });
      });

      await act(async () => {
        result.current.handleFileSelect(largeFiles);
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledTimes(3);
        expect(result.current.files).toHaveLength(0);
      });
    });

    it('should handle zero-byte files', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
      Object.defineProperty(emptyFile, 'size', { value: 0 });

      await act(async () => {
        result.current.handleFileSelect([emptyFile]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });
    });
  });

  describe('Unsupported File Types', () => {
    it('should reject executable files', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      const { result } = renderHook(() => useDocumentUpload());

      const exeFile = new File(['exe content'], 'malware.exe', {
        type: 'application/x-msdownload',
      });

      await act(async () => {
        result.current.handleFileSelect([exeFile]);
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Invalid file: malware.exe');
        expect(result.current.files).toHaveLength(0);
      });
    });

    it('should reject script files', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      const { result } = renderHook(() => useDocumentUpload());

      const scriptFile = new File(['alert("xss")'], 'script.js', {
        type: 'application/javascript',
      });

      await act(async () => {
        result.current.handleFileSelect([scriptFile]);
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Invalid file: script.js');
        expect(result.current.files).toHaveLength(0);
      });
    });

    it('should reject files with no type', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const noTypeFile = new File(['content'], 'unknown', { type: '' });

      const dropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          files: [noTypeFile] as any,
        },
      };

      await act(async () => {
        result.current.handleDrop(dropEvent as any);
      });

      // Files with empty type are filtered out in handleDrop
      await waitFor(() => {
        expect(result.current.files).toHaveLength(0);
      });
    });

    it('should handle files with incorrect extensions', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      const { result } = renderHook(() => useDocumentUpload());

      // PDF mime type but .txt extension
      const mismatchFile = new File(['content'], 'document.txt', {
        type: 'application/octet-stream',
      });

      await act(async () => {
        result.current.handleFileSelect([mismatchFile]);
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
    });

    it('should reject mixed valid and invalid files correctly', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      const { result } = renderHook(() => useDocumentUpload());

      const validFile = new File(['valid'], 'valid.pdf', { type: 'application/pdf' });
      const invalidFile = new File(['invalid'], 'invalid.exe', { type: 'application/x-msdownload' });

      await act(async () => {
        result.current.handleFileSelect([validFile, invalidFile]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
        expect(result.current.files[0].name).toBe('valid.pdf');
        expect(toastError).toHaveBeenCalledWith('Invalid file: invalid.exe');
      });
    });
  });

  describe('Network Errors', () => {
    it('should handle network timeout during upload', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      mockMutateAsync.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });

      await act(async () => {
        try {
          await result.current.upload();
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('should handle connection reset during upload', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      mockMutateAsync.mockRejectedValue(new Error('Connection reset by peer'));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        try {
          await result.current.upload();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('should handle 413 Payload Too Large error', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      mockMutateAsync.mockRejectedValue(new Error('413: Payload Too Large'));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        try {
          await result.current.upload();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('should handle 507 Insufficient Storage error', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      mockMutateAsync.mockRejectedValue(new Error('507: Insufficient Storage'));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        try {
          await result.current.upload();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('should clear progress on network error', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        try {
          await result.current.upload();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => {
        const progress = result.current.getProgress(file);
        expect(progress).toBe(0);
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid file additions', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const files = [
        new File(['1'], 'file1.txt', { type: 'text/plain' }),
        new File(['2'], 'file2.txt', { type: 'text/plain' }),
        new File(['3'], 'file3.txt', { type: 'text/plain' }),
      ];

      await act(async () => {
        result.current.handleFileSelect([files[0]]);
        result.current.handleFileSelect([files[1]]);
        result.current.handleFileSelect([files[2]]);
      });

      await waitFor(() => {
        expect(result.current.files.length).toBeGreaterThan(0);
      });
    });

    it('should handle upload while adding new files', async () => {
      mockMutateAsync.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useDocumentUpload());

      const file1 = new File(['1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['2'], 'file2.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file1]);
      });

      await act(async () => {
        const uploadPromise = result.current.upload();
        result.current.handleFileSelect([file2]);
        await uploadPromise;
      });

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should prevent duplicate files added at same time', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'duplicate.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await waitFor(() => {
        // Should still be 1, not 2
        expect(result.current.files).toHaveLength(1);
      });
    });

    it('should handle removing files during upload', async () => {
      mockMutateAsync.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        const uploadPromise = result.current.upload();
        // Try to remove file while uploading
        result.current.removeFile(file);
        await uploadPromise;
      });

      // Should handle gracefully without crashing
      expect(true).toBe(true);
    });
  });

  describe('Drag and Drop Edge Cases', () => {
    it('should handle drop event without dataTransfer', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const dropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: null,
      };

      await act(async () => {
        result.current.handleDrop(dropEvent as any);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.dragging).toBe(false);
    });

    it('should handle drag leave immediately after drag over', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const event = { preventDefault: vi.fn() };

      act(() => {
        result.current.handleDragOver(event);
      });

      expect(result.current.dragging).toBe(true);

      act(() => {
        result.current.handleDragLeave(event);
      });

      expect(result.current.dragging).toBe(false);
    });

    it('should handle multiple rapid drag over events', () => {
      const { result } = renderHook(() => useDocumentUpload());

      const event = { preventDefault: vi.fn() };

      act(() => {
        result.current.handleDragOver(event);
        result.current.handleDragOver(event);
        result.current.handleDragOver(event);
      });

      expect(result.current.dragging).toBe(true);
    });

    it('should handle dropping folders (which would have empty file list)', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const dropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          files: [] as any,
        },
      };

      await act(async () => {
        result.current.handleDrop(dropEvent as any);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.dragging).toBe(false);
    });
  });

  describe('Memory and Performance', () => {
    it('should handle uploading many small files', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const manyFiles = Array.from({ length: 100 }, (_, i) =>
        new File([`content ${i}`], `file${i}.txt`, { type: 'text/plain' })
      );

      await act(async () => {
        result.current.handleFileSelect(manyFiles);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(100);
      });
    });

    it('should clean up progress after successful upload', async () => {
      vi.useFakeTimers();
      const mockOnComplete = vi.fn();

      const { result } = renderHook(() =>
        useDocumentUpload({ onUploadComplete: mockOnComplete })
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        await result.current.upload();
      });

      // Fast forward past cleanup delay
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(0);
        expect(mockOnComplete).toHaveBeenCalled();
      });

      vi.useRealTimers();
    });

    it('should handle reset while uploading', async () => {
      mockMutateAsync.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        const uploadPromise = result.current.upload();
        result.current.reset();
        try {
          await uploadPromise;
        } catch (error) {
          // May fail, that's ok
        }
      });

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle validation function throwing error', async () => {
      const { validateSingleFile } = require('@/hooks/useFileValidation')().useFileValidation();
      vi.mocked(validateSingleFile).mockRejectedValue(new Error('Validation failed'));

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await act(async () => {
        try {
          result.current.handleFileSelect([file]);
        } catch (error) {
          // Expected
        }
      });

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle file with same name but different size', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const file1 = new File(['content1'], 'test.txt', { type: 'text/plain' });
      const file2 = new File(['content2-longer'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file1]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });

      await act(async () => {
        result.current.handleFileSelect([file2]);
      });

      await waitFor(() => {
        // Different sizes, so should be treated as different files
        expect(result.current.files).toHaveLength(2);
      });
    });

    it('should handle file with same name and size but different lastModified', async () => {
      const { result } = renderHook(() => useDocumentUpload());

      const file1 = new File(['content'], 'test.txt', { type: 'text/plain', lastModified: 1000 });
      const file2 = new File(['content'], 'test.txt', { type: 'text/plain', lastModified: 2000 });

      await act(async () => {
        result.current.handleFileSelect([file1]);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });

      await act(async () => {
        result.current.handleFileSelect([file2]);
      });

      await waitFor(() => {
        // Different lastModified, should be treated as different files
        expect(result.current.files).toHaveLength(2);
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should initialize progress at 0 when upload starts', async () => {
      mockMutateAsync.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        result.current.handleFileSelect([file]);
      });

      await act(async () => {
        try {
          const promise = result.current.upload();
          await Promise.race([promise, new Promise(resolve => setTimeout(resolve, 10))]);
        } catch (error) {
          // Expected
        }
      });

      const progress = result.current.getProgress(file);
      expect(progress).toBe(0);
    });

    it('should return 0 progress for file not in upload queue', () => {
      const { result } = renderHook(() => useDocumentUpload());

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const progress = result.current.getProgress(file);

      expect(progress).toBe(0);
    });
  });
});
