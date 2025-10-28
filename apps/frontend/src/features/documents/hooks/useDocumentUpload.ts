"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { useFileValidation } from "@/hooks/useFileValidation";
import { toastError } from "@/lib/toast-helpers";

import { useUploadDocumentsMutation } from "../api/document-service";

interface UseDocumentUploadOptions {
  onUploadComplete?: () => void;
}

interface DropEventLike {
  dataTransfer: DataTransfer | null;
  preventDefault(): void;
}

const makeFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

/**
 * Hook for managing document file uploads with drag-and-drop support.
 * Handles file validation, deduplication, progress tracking, and upload state.
 *
 * @param options - Configuration options
 * @param options.onUploadComplete - Callback invoked after successful upload
 *
 * @returns Object containing:
 *  - files: Array of selected files
 *  - dragging: Whether user is currently dragging files over drop zone
 *  - uploadProgress: Map of file keys to progress percentages (0-100)
 *  - isUploading: Whether upload is in progress
 *  - handleFileSelect: Handle file selection from input or programmatically
 *  - handleDrop: Handle drag-and-drop file drop event
 *  - handleDragOver: Handle drag over event (required for drop to work)
 *  - handleDragLeave: Handle drag leave event
 *  - removeFile: Remove a file from the selection
 *  - upload: Trigger the upload of all selected files
 *  - reset: Clear all files and progress
 *  - getProgress: Get upload progress for a specific file
 *
 * @example
 * ```tsx
 * const { files, dragging, handleFileSelect, handleDrop, handleDragOver, upload } = useDocumentUpload({
 *   onUploadComplete: () => refetchDocuments(),
 * });
 *
 * return (
 *   <div onDrop={handleDrop} onDragOver={handleDragOver} className={dragging ? 'border-blue-500' : ''}>
 *     <input type="file" multiple onChange={(e) => handleFileSelect(e.target.files)} />
 *     <button onClick={upload}>Upload {files.length} files</button>
 *   </div>
 * );
 * ```
 */
export function useDocumentUpload(options: UseDocumentUploadOptions = {}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { validateSingleFile } = useFileValidation();
  const lastUploadedKeysRef = useRef<string[]>([]);

  const uploadMutation = useUploadDocumentsMutation({
    onSuccess: () => {
      lastUploadedKeysRef.current.forEach((key) => {
        setUploadProgress((prev) => ({
          ...prev,
          [key]: 100,
        }));
      });

      setTimeout(() => {
        setUploadProgress({});
        setFiles([]);
        lastUploadedKeysRef.current = [];
        options.onUploadComplete?.();
      }, 350);
    },
    onError: () => {
      lastUploadedKeysRef.current = [];
    },
  });

  const resetDrag = useCallback(() => setDragging(false), []);

  const acceptFiles = useCallback(
    async (incoming: File[]) => {
      if (!incoming.length) {
        return;
      }

      const existingKeys = new Set(files.map(makeFileKey));
      const promised = incoming.map(async (file) => {
        const valid = await validateSingleFile(file);
        return { file, valid };
      });

      const results = await Promise.all(promised);
      const accepted: File[] = [];
      const rejected: File[] = [];

      results.forEach(({ file, valid }) => {
        const key = makeFileKey(file);
        if (!valid) {
          rejected.push(file);
          return;
        }
        if (existingKeys.has(key)) {
          return;
        }
        accepted.push(file);
        existingKeys.add(key);
      });

      if (rejected.length) {
        rejected.forEach((file) => {
          toastError(`Invalid file: ${file.name}`);
        });
      }

      if (accepted.length) {
        setFiles((prev) => [...prev, ...accepted]);
      }
    },
    [files, validateSingleFile]
  );

  const handleFileSelect = useCallback(
    (incoming: ArrayLike<File> | File[]) => {
      const next = Array.from(incoming ?? []);
      void acceptFiles(next);
    },
    [acceptFiles]
  );

  const handleDrop = useCallback(
    (event: DropEventLike) => {
      event.preventDefault();
      const { dataTransfer } = event;
      if (!dataTransfer) {
        resetDrag();
        return;
      }
      const items = Array.from(dataTransfer.files || []);
      void acceptFiles(items.filter((file) => file.type !== ""));
      resetDrag();
    },
    [acceptFiles, resetDrag]
  );

  const handleDragOver = useCallback((event: { preventDefault(): void }) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(
    (event: { preventDefault(): void }) => {
      event.preventDefault();
      resetDrag();
    },
    [resetDrag]
  );

  const removeFile = useCallback((fileToRemove: File) => {
    const key = makeFileKey(fileToRemove);
    setFiles((prev) => prev.filter((file) => makeFileKey(file) !== key));
    setUploadProgress((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const upload = useCallback(async () => {
    if (!files.length) {
      toastError("No files selected");
      return;
    }

    const keys = files.map(makeFileKey);
    lastUploadedKeysRef.current = keys;

    keys.forEach((key) => {
      setUploadProgress((prev) => ({
        ...prev,
        [key]: 0,
      }));
    });

    try {
      await uploadMutation.mutateAsync(files);
    } catch (error) {
      toastError("Upload failed");
      setUploadProgress((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          delete next[key];
        });
        return next;
      });
      throw error;
    }
  }, [files, uploadMutation]);

  const reset = useCallback(() => {
    setFiles([]);
    setUploadProgress({});
    lastUploadedKeysRef.current = [];
  }, []);

  const state = useMemo(
    () => ({
      files,
      dragging,
      uploadProgress,
      isUploading: uploadMutation.isPending,
    }),
    [files, dragging, uploadProgress, uploadMutation.isPending]
  );

  const getProgress = useCallback(
    (file: File) => uploadProgress[makeFileKey(file)] ?? 0,
    [uploadProgress]
  );

  return {
    ...state,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    removeFile,
    upload,
    reset,
    getProgress,
  };
}
