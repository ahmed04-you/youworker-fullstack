import { useCallback, useState } from "react";
import { toast } from "sonner";

interface OptimisticUpdateOptions<T> {
  onMutate: (newData: T) => void;
  onSuccess?: (data: T) => void;
  onError?: (error: Error, rollbackData: T) => void;
}

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
        toast.error(error.message || "Operation failed");

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