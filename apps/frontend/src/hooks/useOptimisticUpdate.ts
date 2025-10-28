import { useCallback, useState } from "react";

import { toastError } from "@/lib/toast-helpers";

interface OptimisticUpdateOptions<T> {
  onMutate: (newData: T) => void;
  onSuccess?: (data: T) => void;
  onError?: (error: Error, rollbackData: T) => void;
}

/**
 * Hook for implementing optimistic UI updates with automatic rollback on error.
 * Updates the UI immediately before the API call, then rolls back if the mutation fails.
 *
 * @template T - Type of data being mutated
 * @param mutationFn - Async function that performs the mutation
 * @param options - Configuration object with lifecycle handlers
 * @param options.onMutate - Called immediately with new data for optimistic UI update
 * @param options.onSuccess - Called when mutation succeeds
 * @param options.onError - Called when mutation fails, receives error and previous data for rollback
 *
 * @returns Object containing:
 *  - execute: Function to trigger the optimistic update
 *  - isLoading: Whether the mutation is in progress
 *  - error: Error from the last failed mutation
 *
 * @example
 * ```tsx
 * const { execute, isLoading } = useOptimisticUpdate(
 *   (newName: string) => api.updateName(newName),
 *   {
 *     onMutate: (newName) => setName(newName),
 *     onError: (error, oldName) => setName(oldName),
 *   }
 * );
 *
 * const handleUpdate = () => {
 *   execute(newName, previousName);
 * };
 * ```
 */
export function useOptimisticUpdate<T>(
  mutationFn: (data: T) => Promise<any>,
  options: OptimisticUpdateOptions<T>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (newData: T, previousData: T) => {
      setIsLoading(true);
      setError(null);

      // Optimistically update UI
      options.onMutate(newData);

      try {
        const result = await mutationFn(newData);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);

        // Rollback on error
        options.onError?.(error, previousData);
        toastError(error.message || "Operation failed");

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options]
  );

  return {
    execute,
    isLoading,
    error,
  };
}
