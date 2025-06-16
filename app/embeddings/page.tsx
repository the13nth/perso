"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, StickyNote, Activity, Trash2, Database, LineChart, Minimize2 } from "lucide-react";
import { format } from "date-fns";
import StorageDocuments from "./StorageDocuments";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import VisualizationTab from "./VisualizationTab";
import SimplifiedVisualizationTab from "./SimplifiedVisualizationTab";

interface Note {
  id: string;
  title: string;
  content: string;
  categories: string[];
  access: string;
  format: string;
  isPinned: boolean;
  isStarred: boolean;
  color: string;
  createdAt: string;
}

interface Activity {
  id: string;
  activity: string;
  categories: string[];
  category: string;
  createdAt: string;
  processingProgress: number;
  status: string;
  text: string;
  structuredData: {
    access: string;
    activity: {
      activityType: string;
      duration: string;
      endTime: string;
      energy: number;
    }
  };
  updatedAt: string;
}

interface FirebaseData {
  notes: Note[];
  activities: Activity[];
}

interface NoteWithEmbeddings extends Note {
  embeddings: {
    totalChunks: number;
    embeddingDimensions: number;
    lastUpdated: string | null;
  } | null;
}

interface ActivityWithEmbeddings extends Activity {
  embeddings: {
    totalChunks: number;
    embeddingDimensions: number;
    lastUpdated: string | null;
  } | null;
}

interface StorageDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  downloadUrl?: string;
  path: string;
}

interface DocumentWithEmbeddings extends StorageDocument {
  embeddings: {
    totalChunks: number;
    embeddingDimensions: number;
    lastUpdated: string | null;
  } | null;
}

interface NotesTabProps {
  notes: NoteWithEmbeddings[];
  loading: boolean;
  error: string | null;
  processing: Set<string>;
  onEmbed: (note: NoteWithEmbeddings) => Promise<void>;
  onDeleteEmbeddings: (note: NoteWithEmbeddings) => Promise<void>;
}

interface ActivitiesTabProps {
  activities: ActivityWithEmbeddings[];
  loading: boolean;
  error: string | null;
  processing: Set<string>;
  onEmbed: (activity: ActivityWithEmbeddings) => Promise<void>;
  onDeleteEmbeddings: (activity: ActivityWithEmbeddings) => Promise<void>;
}

const NotesTab = memo(function NotesTab({ 
  notes, 
  loading, 
  error, 
  processing, 
  onEmbed, 
  onDeleteEmbeddings 
}: NotesTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (notes.length === 0) {
    return <div className="text-center text-muted-foreground">No notes found</div>;
  }

  return (
    <>
      {notes.map((note) => (
        <Card key={note.id}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg line-clamp-1">{note.title || "Untitled Note"}</CardTitle>
              <div className="flex items-center gap-2">
                {processing.has(note.id) ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : note.embeddings ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteEmbeddings(note)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Delete Embeddings</span>
                    <span className="sm:hidden">Delete</span>
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onEmbed(note)}
                    className="w-full sm:w-auto"
                  >
                    <Database className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Embed</span>
                    <span className="sm:hidden">Embed</span>
                  </Button>
                )}
              </div>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Created: {format(note.createdAt, 'PPP')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <p className="line-clamp-2 text-xs sm:text-sm">{note.content}</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2">
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {note.categories?.map((category: string) => (
                    <span key={category} className="bg-secondary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs">
                      {category}
                    </span>
                  ))}
                </div>
                {note.embeddings && (
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {note.embeddings.totalChunks} chunks
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-muted-foreground">
                      {note.embeddings.embeddingDimensions}d
                    </span>
                    {note.embeddings.lastUpdated && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-muted-foreground hidden sm:inline">
                          Updated: {format(new Date(note.embeddings.lastUpdated), 'PPP')}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
});

const ActivitiesTab = memo(function ActivitiesTab({ 
  activities,
  loading,
  error,
  processing,
  onEmbed,
  onDeleteEmbeddings
}: ActivitiesTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (activities.length === 0) {
    return <div className="text-center text-muted-foreground">No activities found</div>;
  }

  return (
    <>
      {activities.map((activity) => (
        <Card key={activity.id}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg line-clamp-1">{activity.activity}</CardTitle>
              <div className="flex items-center gap-2">
                {processing.has(activity.id) ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : activity.embeddings ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteEmbeddings(activity)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Delete Embeddings</span>
                    <span className="sm:hidden">Delete</span>
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onEmbed(activity)}
                    className="w-full sm:w-auto"
                  >
                    <Database className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Embed</span>
                    <span className="sm:hidden">Embed</span>
                  </Button>
                )}
              </div>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Type: {activity.activity} • Created: {format(activity.createdAt, 'PPP')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <p className="line-clamp-2 text-xs sm:text-sm">{activity.text}</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2">
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {activity.categories?.map((category: string) => (
                    <span key={category} className="bg-secondary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs">
                      {category}
                    </span>
                  ))}
                </div>
                {activity.embeddings && (
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {activity.embeddings.totalChunks} chunks
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-muted-foreground">
                      {activity.embeddings.embeddingDimensions}d
                    </span>
                    {activity.embeddings.lastUpdated && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-muted-foreground hidden sm:inline">
                          Updated: {format(new Date(activity.embeddings.lastUpdated), 'PPP')}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {activity.structuredData && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                  <div>Duration: {activity.structuredData.activity.duration}</div>
                  <div>Energy: {activity.structuredData.activity.energy}</div>
                  {activity.structuredData.activity.endTime && (
                    <div>Date: {format(new Date(activity.structuredData.activity.endTime), 'PPP')}</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
});

export default function EmbeddingsPage() {
  const [data, setData] = useState<FirebaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteWithEmbeddings[]>([]);
  const [activities, setActivities] = useState<ActivityWithEmbeddings[]>([]);
  const [documents, setDocuments] = useState<DocumentWithEmbeddings[]>([]);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const fetchNotes = async () => {
    try {
      // Fetch notes from Firebase
      const response = await fetch("/api/embeddings/firebase-data");
      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }
      const data = await response.json();
      
      // Fetch embedding metadata for each note
      const notesWithEmbeddings = await Promise.all(
        data.notes.map(async (note: Note) => {
          try {
            const metadataResponse = await fetch(`/api/embeddings/note-metadata?noteId=${encodeURIComponent(note.id)}`);
            if (!metadataResponse.ok) {
              throw new Error("Failed to fetch embedding metadata");
            }
            const { metadata } = await metadataResponse.json();
            return { ...note, embeddings: metadata };
          } catch (error) {
            console.error(`Error fetching metadata for note ${note.id}:`, error);
            return { ...note, embeddings: null };
          }
        })
      );

      setNotes(notesWithEmbeddings);
    } catch (error) {
      console.error("Error fetching notes:", error);
      setError("Failed to fetch notes");
    }
  };

  const fetchActivities = async () => {
    try {
      // Fetch activities from Firebase
      const response = await fetch("/api/embeddings/firebase-data");
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }
      const data = await response.json();
      
      // Fetch embedding metadata for each activity
      const activitiesWithEmbeddings = await Promise.all(
        data.activities.map(async (activity: Activity) => {
          try {
            const metadataResponse = await fetch(`/api/embeddings/activity-metadata?activityId=${encodeURIComponent(activity.id)}`);
            if (!metadataResponse.ok) {
              throw new Error("Failed to fetch embedding metadata");
            }
            const { metadata } = await metadataResponse.json();
            return { ...activity, embeddings: metadata };
          } catch (error) {
            console.error(`Error fetching metadata for activity ${activity.id}:`, error);
            return { ...activity, embeddings: null };
          }
        })
      );

      setActivities(activitiesWithEmbeddings);
    } catch (error) {
      console.error("Error fetching activities:", error);
      setError("Failed to fetch activities");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/embeddings/firebase-data');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const result = await response.json();
        setData(result);

        // Fetch notes and activities in parallel
        await Promise.all([
          fetchNotes(),
          fetchActivities()
        ]);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEmbed = async (note: NoteWithEmbeddings) => {
    try {
      setProcessing(prev => new Set([...prev, note.id]));
      
      const response = await fetch("/api/retrieval/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: note.content,
          title: note.title,
          categories: note.categories,
          access: note.access,
          format: note.format,
          isPinned: note.isPinned,
          isStarred: note.isStarred,
          color: note.color
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to embed note");
      }

      await fetchNotes(); // Refresh the list
      toast.success("Note embedded successfully");
    } catch (error) {
      console.error("Error embedding note:", error);
      toast.error("Failed to embed note");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  };

  const handleDeleteEmbeddings = async (note: NoteWithEmbeddings) => {
    try {
      setProcessing(prev => new Set([...prev, note.id]));
      
      const response = await fetch(`/api/embeddings/note-metadata?noteId=${encodeURIComponent(note.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete embeddings");
      }

      await fetchNotes(); // Refresh the list
      toast.success("Embeddings deleted successfully");
    } catch (error) {
      console.error("Error deleting embeddings:", error);
      toast.error("Failed to delete embeddings");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  };

  const handleEmbedActivity = async (activity: ActivityWithEmbeddings) => {
    try {
      setProcessing(prev => new Set([...prev, activity.id]));
      
      const response = await fetch("/api/retrieval/comprehensive-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: activity.text,
          activity: activity.activity,
          category: activity.category,
          structuredData: {
            duration: activity.structuredData.activity.duration,
            activityDate: activity.structuredData.activity.endTime,
            location: '',
            energy: activity.structuredData.activity.energy
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to embed activity");
      }

      await fetchActivities(); // Refresh the list
      toast.success("Activity embedded successfully");
    } catch (error) {
      console.error("Error embedding activity:", error);
      toast.error("Failed to embed activity");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    }
  };

  const handleDeleteActivityEmbeddings = async (activity: ActivityWithEmbeddings) => {
    try {
      setProcessing(prev => new Set([...prev, activity.id]));
      
      const response = await fetch(`/api/embeddings/activity-metadata?activityId=${encodeURIComponent(activity.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete embeddings");
      }

      await fetchActivities(); // Refresh the list
      toast.success("Embeddings deleted successfully");
    } catch (error) {
      console.error("Error deleting embeddings:", error);
      toast.error("Failed to delete embeddings");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    }
  };

  const memoizedNotes = useMemo(() => ({
    notes,
    loading,
    error,
    processing,
    onEmbed: handleEmbed,
    onDeleteEmbeddings: handleDeleteEmbeddings
  }), [notes, loading, error, processing]);

  const memoizedActivities = useMemo(() => ({
    activities,
    loading,
    error,
    processing,
    onEmbed: handleEmbedActivity,
    onDeleteEmbeddings: handleDeleteActivityEmbeddings
  }), [activities, loading, error, processing]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container mx-auto p-4">
        <Card className="bg-destructive/10">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-4 sm:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Knowledge Base</h1>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <div className="border-b">
          <TabsList className="flex flex-nowrap overflow-x-auto sm:flex-wrap -mb-px gap-1 sm:gap-2 p-1 sm:p-0 bg-transparent">
            <TabsTrigger 
              value="documents" 
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
              <span className="sm:hidden">Docs</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notes" 
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors whitespace-nowrap"
            >
              <StickyNote className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
              <span className="sm:hidden">Notes</span>
              <span className="text-xs">({notes.length})</span>
            </TabsTrigger>
            <TabsTrigger 
              value="activities" 
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors whitespace-nowrap"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activities</span>
              <span className="sm:hidden">Acts</span>
              <span className="text-xs">({activities.length})</span>
            </TabsTrigger>
            <TabsTrigger 
              value="visualization" 
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors whitespace-nowrap"
            >
              <LineChart className="h-4 w-4" />
              <span className="hidden sm:inline">Visualization</span>
              <span className="sm:hidden">Viz</span>
            </TabsTrigger>
            <TabsTrigger 
              value="simplified-visualization" 
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors whitespace-nowrap"
            >
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Simplified View</span>
              <span className="sm:hidden">Simple</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="documents" className="space-y-4">
          <StorageDocuments onDocumentsChange={setDocuments} />
        </TabsContent>
        <TabsContent value="notes" className="space-y-4">
          <NotesTab {...memoizedNotes} />
        </TabsContent>
        <TabsContent value="activities" className="space-y-4">
          <ActivitiesTab {...memoizedActivities} />
        </TabsContent>
        <TabsContent value="visualization" className="space-y-4">
          <VisualizationTab 
            documents={documents} 
            notes={notes} 
            activities={activities}
          />
        </TabsContent>
        <TabsContent value="simplified-visualization" className="space-y-4">
          <SimplifiedVisualizationTab 
            documents={documents} 
            notes={notes} 
            activities={activities}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
