"use client";

import { useEffect, useState, useMemo } from "react";
import Embeddings3DPlot from "./Embeddings3DPlot";
import EmbeddingAnalytics from "./EmbeddingAnalytics";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories?: string[] | string;
    category?: string;
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

interface NormalizedEmbedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

interface DashboardProps {
  embeddings: Embedding[];
}

export default function Dashboard({ embeddings }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [localEmbeddings, setLocalEmbeddings] = useState<Embedding[]>(embeddings);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [categoryDistributionExpanded, setCategoryDistributionExpanded] = useState(false);

  // Update local embeddings when props change
  useEffect(() => {
    setLocalEmbeddings(embeddings);
  }, [embeddings]);

  // Clear selections when filtered results change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, selectedCategories]);

  // Delete embedding function
  const deleteEmbedding = async (embeddingId: string) => {
    try {
      setDeletingIds(prev => new Set([...Array.from(prev), embeddingId]));
      
      const response = await fetch('/api/embeddings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeddingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete embedding');
      }

      // Remove the embedding from local state
      setLocalEmbeddings(prev => prev.filter(emb => emb.id !== embeddingId));
      toast.success('Embedding deleted successfully');
    } catch (error) {
      console.error('Error deleting embedding:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete embedding');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(embeddingId);
        return newSet;
      });
    }
  };

  // Toggle individual selection
  const toggleSelection = (embeddingId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(embeddingId)) {
        newSet.delete(embeddingId);
      } else {
        newSet.add(embeddingId);
      }
      return newSet;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(emb => emb.id)));
    }
  };

  // Bulk delete function
  const bulkDeleteEmbeddings = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setBulkDeleting(true);
      const idsToDelete = Array.from(selectedIds);
      
      // Delete all selected embeddings
      const deletePromises = idsToDelete.map(async (embeddingId) => {
        const response = await fetch('/api/embeddings', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeddingId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to delete ${embeddingId}: ${errorData.error}`);
        }
        return embeddingId;
      });

      const deletedIds = await Promise.all(deletePromises);
      
      // Remove deleted embeddings from local state
      setLocalEmbeddings(prev => prev.filter(emb => !deletedIds.includes(emb.id)));
      setSelectedIds(new Set());
      
      toast.success(`Successfully deleted ${deletedIds.length} embedding${deletedIds.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error during bulk delete:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete some embeddings');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Normalize embeddings to ensure categories is always a string array
  const normalizedEmbeddings = useMemo<NormalizedEmbedding[]>(() => {
    return localEmbeddings.map(emb => {
      let categories: string[] = [];
      
      // Handle different category formats
      if (emb.metadata.categories) {
        if (Array.isArray(emb.metadata.categories)) {
          categories = emb.metadata.categories;
        } else if (typeof emb.metadata.categories === 'string') {
          try {
            // Try to parse JSON string
            const parsed = JSON.parse(emb.metadata.categories);
            categories = Array.isArray(parsed) ? parsed : [emb.metadata.categories];
          } catch {
            categories = [emb.metadata.categories];
          }
        }
      } else if (emb.metadata.category && typeof emb.metadata.category === 'string') {
        categories = [emb.metadata.category];
      } else {
        categories = ["Uncategorized"];
      }
      
      return {
        ...emb,
        metadata: {
          ...emb.metadata,
          categories
        }
      };
    });
  }, [localEmbeddings]);

  // Extract all unique categories
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>();
    normalizedEmbeddings.forEach(e => {
      if (e.metadata.categories && Array.isArray(e.metadata.categories)) {
        e.metadata.categories.forEach(cat => categorySet.add(cat));
      }
    });
    return Array.from(categorySet).sort();
  }, [normalizedEmbeddings]);

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Category statistics
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    normalizedEmbeddings.forEach(e => {
      e.metadata.categories.forEach(cat => {
        stats[cat] = (stats[cat] || 0) + 1;
      });
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [normalizedEmbeddings]);

  // Filtered embeddings for analysis
  const filtered = useMemo(() => {
    return normalizedEmbeddings.filter(e => {
      // Filter by text search
      const matchesSearch = !search || 
        (e.metadata.text && typeof e.metadata.text === 'string' && 
         e.metadata.text.toLowerCase().includes(search.toLowerCase()));
      
      // Filter by selected categories
      const matchesCategories = selectedCategories.length === 0 || 
        (e.metadata.categories && 
         selectedCategories.some(cat => e.metadata.categories.includes(cat)));
      
      return matchesSearch && matchesCategories;
    });
  }, [normalizedEmbeddings, search, selectedCategories]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full bg-background text-foreground overflow-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Embeddings Dashboard</h1>
      
      {/* Search & Filter Controls */}
      <div className="mb-4 sm:mb-6 space-y-4">
        <div>
          <input
            type="text"
            placeholder="Search text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-md px-3 py-2.5 sm:py-2 w-full max-w-md text-sm bg-background border-input focus:ring-2 focus:ring-ring focus:border-transparent outline-none min-h-[44px] sm:min-h-[40px]"
          />
        </div>
        
        {allCategories.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 sm:mb-3">Filter by Category:</h3>
            <div className="flex flex-wrap gap-2 mb-2 sm:mb-3">
              {allCategories.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors min-h-[40px] touch-manipulation ${
                    selectedCategories.includes(category)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground italic">
              {allCategories.length} categories found. Click to toggle selection.
            </div>
          </div>
        )}
      </div>

      {/* Category Distribution */}
      {categoryStats.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => setCategoryDistributionExpanded(!categoryDistributionExpanded)}
            className="w-full justify-between p-3 h-auto"
          >
            <h3 className="text-sm font-medium">Category Distribution ({categoryStats.length} categories)</h3>
            {categoryDistributionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          
          {categoryDistributionExpanded && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {categoryStats.map(([category, count]) => (
                <div 
                  key={category}
                  className="bg-muted/40 rounded-md p-3 text-sm flex justify-between items-center cursor-pointer hover:bg-muted/60 transition-colors min-h-[48px] touch-manipulation"
                  onClick={() => toggleCategory(category)}
                >
                  <span className="truncate mr-2 text-sm">{category}</span>
                  <span className="bg-muted rounded-full px-2 py-1 text-xs font-medium flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="visualization" className="mt-4 sm:mt-6">
        <TabsList className="grid w-full grid-cols-3 sticky top-0 z-50 bg-background h-11 sm:h-12">
          <TabsTrigger value="visualization" className="text-sm sm:text-base">3D Visualization</TabsTrigger>
          <TabsTrigger value="table" className="text-sm sm:text-base">Table View</TabsTrigger>
          <TabsTrigger value="analysis" className="text-sm sm:text-base">Analysis</TabsTrigger>
        </TabsList>
        
        <div className="mt-4 sm:mt-6">
          <TabsContent value="visualization" className="space-y-4 sm:space-y-6">
            {normalizedEmbeddings.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <Embeddings3DPlot embeddings={normalizedEmbeddings} />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="table" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Embeddings Data</CardTitle>
                <CardDescription>
                  View and manage your embeddings. You can delete individual embeddings or select multiple for bulk operations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No embeddings found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
                  </div>
                ) : (
                  <>
                    {/* Bulk Actions Bar */}
                    {selectedIds.size > 0 && (
                      <div className="flex items-center justify-between p-3 mb-4 bg-muted/50 rounded-lg border">
                        <div className="text-sm text-muted-foreground">
                          {selectedIds.size} embedding{selectedIds.size > 1 ? 's' : ''} selected
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={bulkDeleting}
                          >
                            Clear Selection
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={bulkDeleteEmbeddings}
                            disabled={bulkDeleting}
                          >
                            {bulkDeleting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Selected ({selectedIds.size})
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={selectedIds.size === filtered.length && filtered.length > 0}
                                onCheckedChange={toggleSelectAll}
                                aria-label="Select all embeddings"
                              />
                            </TableHead>
                            <TableHead className="w-[200px]">ID</TableHead>
                            <TableHead>Text Preview</TableHead>
                            <TableHead>Categories</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((embedding) => (
                            <TableRow key={embedding.id} className={selectedIds.has(embedding.id) ? "bg-muted/30" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(embedding.id)}
                                  onCheckedChange={() => toggleSelection(embedding.id)}
                                  aria-label={`Select embedding ${embedding.id}`}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {embedding.id.length > 30 
                                  ? `${embedding.id.substring(0, 15)}...${embedding.id.substring(embedding.id.length - 15)}`
                                  : embedding.id
                                }
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div className="truncate">
                                  {embedding.metadata.text?.substring(0, 100)}
                                  {(embedding.metadata.text?.length || 0) > 100 && "..."}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {embedding.metadata.categories.map((category) => (
                                    <span
                                      key={category}
                                      className="inline-block px-2 py-1 text-xs bg-secondary rounded-md"
                                    >
                                      {category}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteEmbedding(embedding.id)}
                                  disabled={deletingIds.has(embedding.id) || bulkDeleting}
                                  className="h-8 w-8 p-0"
                                >
                                  {deletingIds.has(embedding.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analysis" className="space-y-4 sm:space-y-6">
            <EmbeddingAnalytics embeddings={filtered} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
} 