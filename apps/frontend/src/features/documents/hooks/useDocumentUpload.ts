"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useFileValidation } from "@/hooks/useFileValidation";

import { useUploadDocumentsMutation } from "../api/document-service";

interface UseDocumentUploadOptions {
  onUploadComplete?: () => void;
}

interface DropEventLike {
  dataTransfer: DataTransfer | null;
  preventDefault(): void;
}

const makeFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

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
          toast.error(`Invalid file: ${file.name}`);
        });
      }

      if (accepted.length) {
        setFiles((prev) => [...prev, ...accepted]);
      }
    },
    [files, validateSingleFile]
  );

  const handleFileSelect = useCallback(
    (incoming: FileList | File[]) => {
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
      toast.error("No files selected");
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
      toast.error("Upload failed");
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
