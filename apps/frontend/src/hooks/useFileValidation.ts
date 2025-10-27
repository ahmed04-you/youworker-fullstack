import { useState, useCallback } from "react";
import { z } from "zod";
import { fileValidationSchema, multipleFilesValidationSchema } from "@/lib/validation";

interface ValidationError {
  field: string;
  message: string;
}

export function useFileValidation() {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateSingleFile = useCallback(
    async (file: File): Promise<boolean> => {
      setIsValidating(true);
      setErrors([]);

      try {
        await fileValidationSchema.parseAsync({ file });
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationErrors = error.issues.map((err: any) => ({
            field: err.path.join("."),
            message: err.message,
          }));
          setErrors(validationErrors);
        }
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const validateMultipleFiles = useCallback(
    async (files: FileList): Promise<boolean> => {
      setIsValidating(true);
      setErrors([]);

      try {
        await multipleFilesValidationSchema.parseAsync({ files });
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationErrors = error.issues.map((err: any) => ({
            field: err.path.join("."),
            message: err.message,
          }));
          setErrors(validationErrors);
        }
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    errors,
    isValidating,
    validateSingleFile,
    validateMultipleFiles,
    clearErrors,
  };
}