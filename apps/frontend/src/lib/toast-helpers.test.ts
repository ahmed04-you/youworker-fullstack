import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  commonToasts,
  toastError,
  toastInfo,
  toastLoading,
  toastLoadingError,
  toastLoadingSuccess,
  toastSuccess,
  toastWarning,
} from "./toast-helpers";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
    info: mocks.info,
    loading: mocks.loading,
  },
}));

describe("toast-helpers", () => {
  beforeEach(() => {
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.warning.mockReset();
    mocks.info.mockReset();
    mocks.loading.mockReset();
  });

  it("wraps toast.success with sensible defaults", () => {
    toastSuccess("Saved");
    expect(mocks.success).toHaveBeenCalledWith("Saved", { duration: 2000 });

    toastSuccess("With override", { duration: 1234 });
    expect(mocks.success).toHaveBeenCalledWith("With override", { duration: 1234 });
  });

  it("wraps toast.error and preserves action metadata", () => {
    const retry = vi.fn();
    toastError("Failed", { action: { label: "Retry", onClick: retry } });
    expect(mocks.error).toHaveBeenCalledWith("Failed", {
      duration: 4000,
      action: { label: "Retry", onClick: retry },
    });
  });

  it("provides helpers for warning and info variants", () => {
    toastWarning("Heads up");
    expect(mocks.warning).toHaveBeenCalledWith("Heads up", { duration: 3500 });

    toastInfo("FYI", { duration: 1111 });
    expect(mocks.info).toHaveBeenCalledWith("FYI", { duration: 1111 });
  });

  it("handles loading lifecycle helpers", () => {
    mocks.loading.mockReturnValueOnce("toast-id");
    const toastId = toastLoading("Uploading…");
    expect(toastId).toBe("toast-id");
    expect(mocks.loading).toHaveBeenCalledWith("Uploading…");

    toastLoadingSuccess("toast-id", "Done");
    expect(mocks.success).toHaveBeenCalledWith("Done", { id: "toast-id" });

    toastLoadingError("toast-id", "Failed");
    expect(mocks.error).toHaveBeenCalledWith("Failed", { id: "toast-id" });
  });

  it("exports common toast shortcuts", () => {
    commonToasts.sessionCreated();
    expect(mocks.success).toHaveBeenCalledWith("Session created", { duration: 2000 });

    commonToasts.documentUploadFailed();
    expect(mocks.error).toHaveBeenCalledWith("Upload failed", {
      duration: 4000,
      action: undefined,
    });
  });
});
