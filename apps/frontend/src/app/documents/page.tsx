"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArrowDownToLine,
  Check,
  Clock,
  ExternalLink,
  FileStack,
  Loader2,
  ScanText,
  Tag,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, API_BASE_URL, ApiError } from "@/lib/api-client";
import {
  DocumentRecord,
  DocumentsResponse,
  IngestionRunRecord,
  IngestionRunsResponse,
} from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size > 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const getDocumentName = (doc: DocumentRecord) =>
  doc.uri || doc.path || `Document #${doc.id}`;

const parseTags = (tags: string) =>
  tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export default function DocumentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [runs, setRuns] = useState<IngestionRunRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const [selectedCollection, setSelectedCollection] = useState<string>("all");

  const [uploading, setUploading] = useState(false);
  const [pathIngesting, setPathIngesting] = useState(false);
  const [urlIngesting, setUrlIngesting] = useState(false);
  const [textIngesting, setTextIngesting] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [collectionName, setCollectionName] = useState("knowledge");
  const [tagInput, setTagInput] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [textTitle, setTextTitle] = useState("Manual Note");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/settings");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void refreshDocuments();
      void refreshRuns();
    }
  }, [authLoading, isAuthenticated]);

  const collections = useMemo(() => {
    const values = new Set<string>();
    documents.forEach((doc) => {
      if (doc.collection) {
        values.add(doc.collection);
      }
    });
    return Array.from(values).sort();
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (selectedCollection === "all") {
      return documents;
    }
    return documents.filter((doc) => doc.collection === selectedCollection);
  }, [documents, selectedCollection]);

  const totalBytes = documents.reduce((acc, doc) => acc + (doc.bytes_size || 0), 0);
  const totalChunks = runs.reduce((acc, run) => acc + (run.totals_chunks || 0), 0);

  async function refreshDocuments() {
    setDocumentsLoading(true);
    try {
      const response = await apiGet<DocumentsResponse>("/v1/documents", {
        query: { limit: 200 },
      });
      setDocuments(response.documents);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load documents.");
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function refreshRuns() {
    setRunsLoading(true);
    try {
      const response = await apiGet<IngestionRunsResponse>("/v1/ingestion-runs", {
        query: { limit: 50 },
      });
      setRuns(response.runs);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load ingestion history.");
    } finally {
      setRunsLoading(false);
    }
  }

  const handleDeleteDocument = async (documentId: number) => {
    try {
      await apiDelete(`/v1/documents/${documentId}`);
      toast.success("Document deleted.");
      await refreshDocuments();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete document.");
    }
  };

  const handleUploadFiles = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const tags = parseTags(tagInput);
      tags.forEach((tag) => formData.append("tags", tag));
      if (collectionName) {
        formData.append("collection", collectionName);
      }

      const response = await fetch(`${API_BASE_URL}/v1/ingest/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new ApiError(
          details?.detail || "Upload failed",
          response.status,
          details
        );
      }

      toast.success("Upload completed. Documents are being processed.");
      setFiles([]);
      await Promise.all([refreshDocuments(), refreshRuns()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleIngestPath = async () => {
    if (!targetPath.trim()) return;
    setPathIngesting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/ingest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path_or_url: targetPath.trim(),
          from_web: false,
          recursive: true,
          tags: parseTags(tagInput),
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new ApiError(
          details?.detail || "Ingestion failed",
          response.status,
          details
        );
      }
      toast.success("Local content queued for ingestion.");
      setTargetPath("");
      await Promise.all([refreshDocuments(), refreshRuns()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Ingestion failed");
    } finally {
      setPathIngesting(false);
    }
  };

  const handleIngestUrl = async () => {
    if (!inputUrl.trim()) return;
    setUrlIngesting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/ingest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path_or_url: inputUrl.trim(),
          from_web: true,
          recursive: false,
          tags: parseTags(tagInput),
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new ApiError(
          details?.detail || "URL ingestion failed",
          response.status,
          details
        );
      }
      toast.success("URL queued for ingestion.");
      setInputUrl("");
      await Promise.all([refreshDocuments(), refreshRuns()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Ingestion failed");
    } finally {
      setUrlIngesting(false);
    }
  };

  const handleIngestText = async () => {
    if (!rawText.trim()) return;
    setTextIngesting(true);
    try {
      const blob = new Blob([rawText], { type: "text/plain" });
      const textFile = new File(
        [blob],
        `${textTitle.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.txt`,
        { type: "text/plain" }
      );
      const formData = new FormData();
      formData.append("files", textFile);
      const tags = parseTags(tagInput);
      tags.forEach((tag) => formData.append("tags", tag));
      if (collectionName) {
        formData.append("collection", collectionName);
      }

      const response = await fetch(`${API_BASE_URL}/v1/ingest/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new ApiError(
          details?.detail || "Text ingestion failed",
          response.status,
          details
        );
      }

      toast.success("Text ingested successfully.");
      setRawText("");
      await Promise.all([refreshDocuments(), refreshRuns()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Text ingestion failed");
    } finally {
      setTextIngesting(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-3xl border border-border px-6 py-8 text-sm text-muted-foreground shadow-sm">
          Authenticating…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card/60 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Knowledge Foundry
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              Curate your intelligent workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Blend uploaded files, crawled URLs, and live notes. Each ingestion feeds vector
              search and tool orchestration for crimson-fast retrieval.
            </p>
          </div>
          <Button
            variant="secondary"
            className="rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => refreshDocuments()}
          >
            {documentsLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Refresh catalog
              </>
            )}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl border border-border/70 bg-background/70 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Documents
                </p>
                <p className="text-2xl font-semibold text-foreground">{documents.length}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(totalBytes)} indexed
                </p>
              </div>
              <FileStack className="h-10 w-10 text-primary" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-background/70 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Ingestion runs
                </p>
                <p className="text-2xl font-semibold text-foreground">{runs.length}</p>
                <p className="text-xs text-muted-foreground">{totalChunks} chunks processed</p>
              </div>
              <UploadCloud className="h-10 w-10 text-primary" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-background/70 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Collections
                </p>
                <p className="text-2xl font-semibold text-foreground">{collections.length}</p>
                <p className="text-xs text-muted-foreground">Adaptive knowledge clusters</p>
              </div>
              <Archive className="h-10 w-10 text-primary" />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-3xl border border-border bg-card/75 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <UploadCloud className="h-5 w-5 text-primary" />
            Ingestion studio
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Combine files, URLs, and quick notes. Tags help the agent prioritize context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <Input
                placeholder="Tags: research, finance"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                className="h-7 flex-1 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              <Archive className="h-3.5 w-3.5 text-primary" />
              <Input
                placeholder="Collection name"
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                className="h-7 flex-1 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
              />
            </div>
          </div>

          <Tabs defaultValue="files" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-background/80 p-1">
              <TabsTrigger value="files" className="rounded-xl text-xs">
                File upload
              </TabsTrigger>
              <TabsTrigger value="url" className="rounded-xl text-xs">
                Fetch URL
              </TabsTrigger>
              <TabsTrigger value="path" className="rounded-xl text-xs">
                Local path
              </TabsTrigger>
              <TabsTrigger value="note" className="rounded-xl text-xs">
                Paste note
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="space-y-4">
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-sm">
                <p className="font-semibold text-primary">Drop documents</p>
                <p className="mt-1 text-muted-foreground">
                  PDFs, text, Markdown, audio, or JSON up to 100 MB each.
                </p>
                <Input
                  type="file"
                  multiple
                  onChange={(event) =>
                    setFiles(event.target.files ? Array.from(event.target.files) : [])
                  }
                  className="mt-4 cursor-pointer border border-border/60 bg-background/80"
                />
              </div>
              <Button
                className="rounded-full"
                onClick={() => void handleUploadFiles()}
                disabled={!files.length || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Commit files
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                <p className="font-semibold text-foreground">Ingest from the web</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crawl and normalize a single page. Recursive crawling is handled automatically
                  when supported.
                </p>
                <Input
                  placeholder="https://example.com/article"
                  value={inputUrl}
                  onChange={(event) => setInputUrl(event.target.value)}
                  className="mt-3"
                />
              </div>
              <Button
                className="rounded-full"
                onClick={() => void handleIngestUrl()}
                disabled={!inputUrl.trim() || urlIngesting}
              >
                {urlIngesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Fetch URL
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="path" className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                <p className="font-semibold text-foreground">Ingest from local path</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Provide an absolute path within the allowed ingestion directories.
                </p>
                <Input
                  placeholder="data/uploads/customer-success"
                  value={targetPath}
                  onChange={(event) => setTargetPath(event.target.value)}
                  className="mt-3"
                />
              </div>
              <Button
                className="rounded-full"
                onClick={() => void handleIngestPath()}
                disabled={!targetPath.trim() || pathIngesting}
              >
                {pathIngesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingesting…
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Ingest directory
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="note" className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                <p className="font-semibold text-foreground">Paste a quick note</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inline knowledge is wrapped into a text document and indexed instantly.
                </p>
                <Input
                  placeholder="Title"
                  value={textTitle}
                  onChange={(event) => setTextTitle(event.target.value)}
                  className="mt-3"
                />
                <textarea
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder="Drop in highlights, meeting notes, or structured data."
                  className="mt-3 min-h-[140px] w-full rounded-2xl border border-border/70 bg-background/90 p-3 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button
                className="rounded-full"
                onClick={() => void handleIngestText()}
                disabled={!rawText.trim() || textIngesting}
              >
                {textIngesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <ScanText className="mr-2 h-4 w-4" />
                    Index note
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileStack className="h-5 w-5 text-primary" />
              Document catalog
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Filter by collection, inspect metadata, and clean up obsolete sources.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCollection}
              onChange={(event) => setSelectedCollection(event.target.value)}
              className="h-9 rounded-full border border-border/70 bg-background/80 px-4 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="all">All collections</option>
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => refreshDocuments()}>
              {documentsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-background/80">
                  <TableHead>Name</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Indexed</TableHead>
                  <TableHead className="w-[90px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Loading documents…
                    </TableCell>
                  </TableRow>
                ) : filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No documents in this collection yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow key={doc.id} className="transition hover:bg-background/70">
                      <TableCell className="max-w-[220px]">
                        <p className="truncate text-sm font-medium text-foreground">
                          {getDocumentName(doc)}
                        </p>
                        {doc.tags?.tags?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                            {doc.tags.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="rounded-full">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {doc.collection || "default"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {doc.source || "unknown"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatBytes(doc.bytes_size)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {doc.last_ingested_at
                          ? new Date(doc.last_ingested_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              Recent ingestion runs
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Track throughput, errors, and completion times across your automations.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshRuns()}>
            {runsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {runsLoading ? (
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
              Loading ingestion history…
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No ingestion yet. Kick off a run above.
            </div>
          ) : (
            runs.slice(0, 12).map((run) => (
              <div
                key={run.id}
                className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{run.target}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(run.started_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>{run.totals_files} files</span>
                    <span>•</span>
                    <span>{run.totals_chunks} chunks</span>
                  </div>
                </div>
                <Badge
                  className={`self-start rounded-full ${
                    run.status === "success"
                      ? "bg-emerald-100 text-emerald-600"
                      : run.status === "partial"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {run.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
