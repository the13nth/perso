"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StorageDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  downloadUrl?: string;
  path: string;
}

interface EmbeddingMetadata {
  totalChunks: number;
  embeddingDimensions: number;
  lastUpdated: string | null;
}

interface DocumentWithEmbeddings extends StorageDocument {
  embeddings: EmbeddingMetadata | null;
}

interface StorageDocumentsProps {
  onDocumentsChange?: (documents: DocumentWithEmbeddings[]) => void;
}

export default function StorageDocuments({ onDocumentsChange }: StorageDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentWithEmbeddings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    onDocumentsChange?.(documents);
  }, [documents, onDocumentsChange]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/storage/documents");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch documents");
      }
      const data = await response.json();
      
      // Handle no documents case
      if (!data.documents || data.documents.length === 0) {
        setDocuments([]);
        return;
      }
      
      // Fetch embedding metadata for each document
      const documentsWithEmbeddings = await Promise.all(
        data.documents.map(async (doc: StorageDocument) => {
          try {
            const metadataResponse = await fetch(`/api/embeddings/document-metadata?fileName=${encodeURIComponent(doc.name)}`);
            if (!metadataResponse.ok) {
              // Don't throw error, just return document without embeddings
              console.warn(`Failed to fetch metadata for ${doc.name}:`, await metadataResponse.text());
              return { ...doc, embeddings: null };
            }
            const { metadata } = await metadataResponse.json();
            return { ...doc, embeddings: metadata };
          } catch (error) {
            console.warn(`Error fetching metadata for document ${doc.name}:`, error);
            return { ...doc, embeddings: null };
          }
        })
      );

      setDocuments(documentsWithEmbeddings);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load documents";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document: DocumentWithEmbeddings) => {
    try {
      setDownloading(prev => new Set([...prev, document.id]));
      
      const response = await fetch(`/api/storage/documents/${document.id}/download`);
      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }
      
      const data = await response.json();
      
      // Create a temporary link and trigger download
      const link = window.document.createElement('a');
      link.href = data.downloadUrl;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      toast.success("Download started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloading(prev => {
        const next = new Set(prev);
        next.delete(document.id);
        return next;
      });
    }
  };

  const handleEmbed = async (document: DocumentWithEmbeddings) => {
    try {
      setProcessing(prev => new Set([...prev, document.id]));
      
      const response = await fetch("/api/retrieval/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          metadata: {
            fileName: document.name,
            fileType: document.type,
            fileSize: document.size,
            fileUrl: document.downloadUrl,
            categories: [],
            access: "personal",
            contentType: "document",
            originalFileName: document.name,
            uploadedAt: new Date().toISOString(),
            status: "pending"
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start embedding");
      }

      toast.success("Started embedding document");
      
      // Refresh the documents list after a delay
      setTimeout(() => {
        fetchDocuments();
      }, 2000);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to embed document");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(document.id);
        return next;
      });
    }
  };

  const handleDeleteEmbeddings = async (document: DocumentWithEmbeddings) => {
    try {
      setProcessing(prev => new Set([...prev, document.id]));
      
      const response = await fetch("/api/embeddings/document-metadata", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: document.name
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete embeddings");
      }

      toast.success("Embeddings deleted successfully");
      await fetchDocuments(); // Refresh the list

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete embeddings");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(document.id);
        return next;
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">Loading documents...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <div className="text-sm text-destructive">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground">Upload some documents to see them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Embeddings</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>{formatFileSize(doc.size)}</TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {doc.embeddings ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-primary" />
                                <Badge variant="secondary">
                                  {doc.embeddings.totalChunks} chunks
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <p>Dimensions: {doc.embeddings.embeddingDimensions}</p>
                                {doc.embeddings.lastUpdated && (
                                  <p>Updated: {new Date(doc.embeddings.lastUpdated).toLocaleString()}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not embedded</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloading.has(doc.id)}
                      >
                        {downloading.has(doc.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      {doc.embeddings ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteEmbeddings(doc)}
                          disabled={processing.has(doc.id)}
                        >
                          {processing.has(doc.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEmbed(doc)}
                          disabled={processing.has(doc.id)}
                        >
                          {processing.has(doc.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Database className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 