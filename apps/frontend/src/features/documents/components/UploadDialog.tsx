import React, { useCallback, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, X, File, Loader2 } from 'lucide-react';
import { useUploadDocumentsMutation } from '../api/document-service';
import { useFileValidation } from '@/hooks/useFileValidation';
import { toast } from 'sonner';
import { UploadDialogProps } from '../types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'audio/mpeg',
  'audio/wav',
];

export function UploadDialog({ open, onOpenChange, onUploadComplete }: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const { validateSingleFile } = useFileValidation();
  const uploadMutation = useUploadDocumentsMutation({ onSuccess: onUploadComplete });

  const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
    const validFiles: File[] = [];
    const invalidFiles: File[] = [];

    for (const file of selectedFiles) {
      const isValid = await validateSingleFile(file);
      if (isValid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      invalidFiles.forEach((file: File) => {
        toast.error(`Invalid file: ${file.name}. Size: ${(file.size / 1024 / 1024).toFixed(1)}MB, Type: ${file.type}`);
      });
    }
    setFiles((prev) => [...prev, ...validFiles]);
  }, [validateSingleFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type !== '');
    handleFileSelect(droppedFiles);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const handleUpload = () => {
    if (files.length === 0) {
      toast.error('No files selected');
      return;
    }

    // Simulate progress for each file
    files.forEach((file) => {
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
    });

    uploadMutation.mutate(files, {
      onSuccess: (data) => {
        // Update progress to 100% on success
        files.forEach((file) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        });
        setTimeout(() => {
          setUploadProgress({});
          setFiles([]);
        }, 500);
      },
      onError: (error) => {
        toast.error('Upload failed');
        console.error('Upload error:', error);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Upload documents to use in chat (Cmd+U)</p>
          </TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Drop files here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports PDF, TXT, CSV, JSON, PNG, JPEG, MP3, WAV (max 100MB each)
            </p>
            <input
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
              className="hidden"
            />
            <Button type="button" asChild className="cursor-pointer">
              <label htmlFor="file-upload">
                Select Files
              </label>
            </Button>
            <input id="file-upload" type="file" className="sr-only" multiple accept={ALLOWED_TYPES.join(',')} onChange={(e) => handleFileSelect(Array.from(e.target.files || []))} />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Selected Files ({files.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((file) => (
                  <div key={file.name} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <File className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadProgress[file.name] > 0 && (
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${uploadProgress[file.name]}%` }}
                          />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(file)}
                        disabled={uploadMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || files.length === 0}
                className="w-full"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${files.length} File${files.length > 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}