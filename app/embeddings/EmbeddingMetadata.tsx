"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface EmbeddingMetadata {
  id: string;
  metadata: {
    text: string;
    type: string;
    userId: string;
    categories?: string[];
    category?: string;
    title?: string;
    createdAt?: string;
    chunkIndex?: number;
    totalChunks?: number;
    source?: string;
    [key: string]: any;
  };
}

interface MetadataResponse {
  items: EmbeddingMetadata[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

type ContentType = 'document' | 'activity' | 'note' | 'insight' | 'all';

export default function EmbeddingMetadata() {
  const [metadata, setMetadata] = useState<MetadataResponse>({
    items: [],
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContentType>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchMetadata(1);
  }, [activeTab]);

  const fetchMetadata = async (page: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: activeTab,
        page: page.toString(),
        limit: '50'
      });
      
      const response = await fetch(`/api/embeddings/metadata?${params}`);
      if (!response.ok) throw new Error("Failed to fetch metadata");
      
      const data: MetadataResponse = await response.json();
      setMetadata(data);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metadata");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchMetadata(newPage);
  };

  const renderPagination = () => (
    <div className="flex items-center justify-between px-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {currentPage}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={!metadata.hasMore || loading}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );

  const renderMetadataTable = (items: EmbeddingMetadata[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title/ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Chunks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.metadata.title || item.id}
              </TableCell>
              <TableCell>{item.metadata.type}</TableCell>
              <TableCell>
                {Array.isArray(item.metadata.categories) 
                  ? item.metadata.categories.join(", ")
                  : item.metadata.category || "N/A"}
              </TableCell>
              <TableCell>
                {item.metadata.createdAt 
                  ? format(new Date(item.metadata.createdAt), 'MMM d, yyyy')
                  : "N/A"}
              </TableCell>
              <TableCell>
                {item.metadata.totalChunks 
                  ? `${item.metadata.chunkIndex || 0 + 1}/${item.metadata.totalChunks}`
                  : "1/1"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {renderPagination()}
    </div>
  );

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-10 h-10 text-destructive mb-4" />
          <p className="text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Embedding Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ContentType)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="document">Documents</TabsTrigger>
            <TabsTrigger value="activity">Activities</TabsTrigger>
            <TabsTrigger value="note">Notes</TabsTrigger>
            <TabsTrigger value="insight">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex justify-center items-center p-6">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              renderMetadataTable(metadata.items)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 