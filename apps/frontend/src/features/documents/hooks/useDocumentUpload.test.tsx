import { act, renderHook } from "@testing-library/react";

import { useDocumentUpload } from "./useDocumentUpload";

type UploadOptions = {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
};

const mocks = vi.hoisted(() => ({
  validateSingleFileMock: vi.fn<(file: File) => Promise<boolean>>(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  mutateAsyncMock: vi.fn<(files: File[]) => Promise<unknown>>(),
  state: {
    uploadOptions: null as UploadOptions | null,
    isPending: false,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastErrorMock,
    success: mocks.toastSuccessMock,
  },
}));

vi.mock("@/hooks/useFileValidation", () => ({
  useFileValidation: () => ({
    validateSingleFile: mocks.validateSingleFileMock,
  }),
}));

vi.mock("../api/document-service", () => ({
  useUploadDocumentsMutation: (options?: UploadOptions) => {
    mocks.state.uploadOptions = options ?? null;
    return {
      mutateAsync: mocks.mutateAsyncMock,
      isPending: mocks.state.isPending,
    };
  },
}));

const {
  validateSingleFileMock,
  toastErrorMock,
  toastSuccessMock,
  mutateAsyncMock,
  state,
} = mocks;

describe("useDocumentUpload", () => {
  beforeEach(() => {
    validateSingleFileMock.mockReset();
    mutateAsyncMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    state.uploadOptions = null;
    state.isPending = false;
    vi.useRealTimers();
  });

  it("adds validated files and avoids duplicates", async () => {
    const fileA = new File(["hello"], "doc-a.txt", { type: "text/plain", lastModified: 1 });
    const fileBCopy = new File(["world"], "doc-b.txt", { type: "text/plain", lastModified: 2 });
    const fileB = new File(["world"], "doc-b.txt", { type: "text/plain", lastModified: 2 });

    validateSingleFileMock.mockResolvedValue(true);

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      result.current.handleFileSelect([fileA, fileB] as unknown as FileList);
      await Promise.resolve();
    });

    await act(async () => {
      result.current.handleFileSelect([fileBCopy] as unknown as FileList);
      await Promise.resolve();
    });

    expect(result.current.files).toHaveLength(2);

    expect(validateSingleFileMock).toHaveBeenCalledTimes(3);
    expect(result.current.files.map((file) => file.name)).toEqual(["doc-a.txt", "doc-b.txt"]);
  });

  it("uploads files, reports progress, and clears after success", async () => {
    vi.useFakeTimers();

    const file = new File(["hello"], "doc.txt", { type: "text/plain", lastModified: 3 });
    validateSingleFileMock.mockResolvedValue(true);
    mutateAsyncMock.mockImplementation(async () => {
      state.uploadOptions?.onSuccess?.([]);
      return [];
    });
    const onUploadComplete = vi.fn();

    const { result } = renderHook(() => useDocumentUpload({ onUploadComplete }));

    await act(async () => {
      result.current.handleFileSelect([file] as unknown as FileList);
      await Promise.resolve();
    });

    expect(result.current.files).toHaveLength(1);

    await act(async () => {
      await result.current.upload();
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith([file]);
    expect(result.current.getProgress(file)).toBe(100);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(onUploadComplete).toHaveBeenCalledTimes(1);
    expect(result.current.files).toHaveLength(0);
    expect(result.current.getProgress(file)).toBe(0);
  });

  it("restores progress and surfaces errors when upload fails", async () => {
    const file = new File(["boom"], "bad.txt", { type: "text/plain", lastModified: 4 });
    validateSingleFileMock.mockResolvedValue(true);

    const uploadError = new Error("network failed");
    mutateAsyncMock.mockImplementation(async () => {
      state.uploadOptions?.onError?.(uploadError);
      throw uploadError;
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      result.current.handleFileSelect([file] as unknown as FileList);
      await Promise.resolve();
    });

    expect(result.current.files).toHaveLength(1);

    let capturedError: unknown;
    await act(async () => {
      capturedError = await result.current.upload().catch((error) => error);
    });

    expect(capturedError).toBe(uploadError);
    expect(toastErrorMock).toHaveBeenCalledWith("Upload failed");
    expect(result.current.getProgress(file)).toBe(0);
    expect(result.current.files).toHaveLength(1);
  });
});
