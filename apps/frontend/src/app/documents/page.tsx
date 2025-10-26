"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { File, Link2, FileText, Upload, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  filename: string;
  status: "processing" | "success" | "error";
  chunks?: number;
  processingTime?: number;
  timestamp: Date;
}

export default function DocumentsPage() {
  const { apiKey, isAuthenticated } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "url" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [collectionName, setCollectionName] = useState("documents");

  if (!isAuthenticated) {
    router.push("/settings");
    return null;
  }

  const handleFileUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("collection_name", collectionName);

    try {
      const response = await fetch("http://localhost:8001/v1/ingestion/upload", {
        method: "POST",
        headers: {
          "X-API-Key": apiKey || "",
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const result = await response.json();
      setDocuments((prev) => [
        ...prev,
        {
          id: result.document_id,
          filename: file.name,
          status: "success",
          chunks: result.chunks,
          processingTime: result.processing_time_ms,
          timestamp: new Date(),
        },
      ]);
      toast.success(`Document "${file.name}" uploaded successfully! Chunks: ${result.chunks}`);
      setFile(null);
    } catch (error) {
      toast.error("Upload failed: " + (error as Error).message);
      setDocuments((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          filename: file.name,
          status: "error",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlIngestion = async () => {
    if (!url.trim()) return;

    setIsUploading(true);

    try {
      const response = await fetch("http://localhost:8001/v1/ingestion/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey || "",
        },
        body: JSON.stringify({ url, collection_name: collectionName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Ingestion failed");
      }

      const result = await response.json();
      setDocuments((prev) => [
        ...prev,
        {
          id: result.document_id,
          filename: url,
          status: "success",
          chunks: result.chunks,
          processingTime: result.processing_time_ms,
          timestamp: new Date(),
        },
      ]);
      toast.success(`URL "${url}" ingested successfully! Chunks: ${result.chunks}`);
      setUrl("");
    } catch (error) {
      toast.error("Ingestion failed: " + (error as Error).message);
      setDocuments((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          filename: url,
          status: "error",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextIngestion = async () => {
    if (!text.trim()) return;

    setIsUploading(true);

    try {
      const response = await fetch("http://localhost:8001/v1/ingestion/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey || "",
        },
        body: JSON.stringify({
          text,
          metadata: { source: "manual", title: "Manual Text" },
          collection_name: collectionName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Ingestion failed");
      }

      const result = await response.json();
      setDocuments((prev) => [
        ...prev,
        {
          id: result.document_id,
          filename: "Manual Text",
          status: "success",
          chunks: result.chunks,
          processingTime: 0,
          timestamp: new Date(),
        },
      ]);
      toast.success(`Text ingested successfully! Chunks: ${result.chunks}`);
      setText("");
    } catch (error) {
      toast.error("Ingestion failed: " + (error as Error).message);
      setDocuments((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          filename: "Manual Text",
          status: "error",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Ingestion
          </CardTitle>
          <CardDescription>Upload files, ingest from URLs, or add raw text to your knowledge base.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Upload */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                  <Upload className="h-6 w-6" />
                  <span>Upload File</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                  <DialogDescription>Supported formats: PDF, TXT, MP3, etc.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file">File</Label>
                    <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <Label htmlFor="collection">Collection Name</Label>
                    <Input
                      id="collection"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder="documents"
                    />
                  </div>
                  <Button onClick={handleFileUpload} disabled={!file || isUploading} className="w-full">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* URL Ingestion */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                  <Link2 className="h-6 w-6" />
                  <span>From URL</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Ingest from URL</DialogTitle>
                  <DialogDescription>Fetch and process content from a web URL.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article"
                    />
                  </div>
                  <div>
                    <Label htmlFor="collection-url">Collection Name</Label>
                    <Input
                      id="collection-url"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder="documents"
                    />
                  </div>
                  <Button onClick={handleUrlIngestion} disabled={!url.trim() || isUploading} className="w-full">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                    Ingest URL
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Text Input */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                  <FileText className="h-6 w-6" />
                  <span>Raw Text</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Raw Text</DialogTitle>
                  <DialogDescription>Directly ingest text content.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="text">Text Content</Label>
                    <textarea
                      id="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Enter your text here..."
                      className="w-full h-32 p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <Label htmlFor="collection-text">Collection Name</Label>
                    <Input
                      id="collection-text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder="documents"
                    />
                  </div>
                  <Button onClick={handleTextIngestion} disabled={!text.trim() || isUploading} className="w-full">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                    Ingest Text
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Your ingested documents and processing status.</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No documents ingested yet. Start by uploading one above.</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.timestamp.toLocaleString()}
                          {doc.chunks && ` • ${doc.chunks} chunks`}
                          {doc.processingTime && ` • ${doc.processingTime}ms`}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.status === "success" ? "bg-green-100 text-green-800" :
                        doc.status === "processing" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {doc.status}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}