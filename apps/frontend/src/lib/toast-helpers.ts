import { toast } from "sonner";

/**
 * Toast helper utilities for consistent toast notifications across the app.
 * Each helper wraps the sonner API so we have a single abstraction point if we
 * ever need to adjust styling, durations, or default behaviour.
 */

/**
 * Success toast - for successful operations.
 */
export const toastSuccess = (message: string, options?: { duration?: number }) => {
  return toast.success(message, {
    duration: options?.duration ?? 2000,
  });
};

/**
 * Error toast - for failed operations.
 */
export const toastError = (
  message: string,
  options?: {
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
) => {
  return toast.error(message, {
    duration: options?.duration ?? 4000,
    action: options?.action,
  });
};

/**
 * Warning toast - for recoverable issues that require user awareness.
 */
export const toastWarning = (message: string, options?: { duration?: number }) => {
  return toast.warning(message, {
    duration: options?.duration ?? 3500,
  });
};

/**
 * Info toast - for informational messages.
 */
export const toastInfo = (message: string, options?: { duration?: number }) => {
  return toast.info(message, {
    duration: options?.duration ?? 3000,
  });
};

/**
 * Loading toast - for ongoing operations.
 * Returns toast ID that can be used to update/dismiss the toast.
 */
export const toastLoading = (message: string) => {
  return toast.loading(message);
};

/**
 * Update a loading toast to success.
 */
export const toastLoadingSuccess = (toastId: string | number, message: string) => {
  return toast.success(message, { id: toastId });
};

/**
 * Update a loading toast to error.
 */
export const toastLoadingError = (toastId: string | number, message: string) => {
  return toast.error(message, { id: toastId });
};

/**
 * Common toast patterns for frequent operations.
 */
export const commonToasts = {
  // Session operations
  sessionCreated: () => toastSuccess("Session created"),
  sessionDeleted: () => toastSuccess("Session deleted"),
  sessionRenamed: () => toastSuccess("Session renamed"),

  // Document operations
  documentUploaded: () => toastSuccess("Document uploaded successfully"),
  documentDeleted: () => toastSuccess("Document deleted"),
  documentUploadFailed: (retry?: () => void) =>
    toastError("Upload failed", {
      action: retry ? { label: "Retry", onClick: retry } : undefined,
    }),

  // Authentication
  loginSuccess: () => toastSuccess("Logged in successfully"),
  loginFailed: () => toastError("Login failed. Please check your credentials."),
  logoutSuccess: () => toastSuccess("Logged out"),

  // Network errors
  networkError: () =>
    toastError("Connection lost. Please check your internet connection.", {
      duration: 5000,
    }),

  // Generic errors
  somethingWentWrong: () => toastError("Something went wrong. Please try again."),

  // Copy operations
  copiedToClipboard: () => toastSuccess("Copied to clipboard"),
  copyFailed: () => toastError("Failed to copy to clipboard"),
};
