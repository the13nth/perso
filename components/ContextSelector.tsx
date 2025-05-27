import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import { UserContext } from '@/lib/pinecone';

interface ContextSelectorProps {
  userId: string;
  onSelectionChange: (selectedIds: string[]) => void;
}

export function ContextSelector({ userId, onSelectionChange }: ContextSelectorProps) {
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadContexts() {
      try {
        const response = await fetch(`/api/contexts?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to load contexts');
        const data = await response.json();
        
        // Transform contexts to ensure they have descriptive titles
        const transformedContexts = data.contexts.map((context: UserContext) => {
          if (!context.title || context.title === 'Untitled') {
            // Generate a title from the first sentence or first N words
            const firstSentence = context.content.split(/[.!?]/).filter(s => s.trim())[0] || '';
            const title = firstSentence.length > 50 
              ? firstSentence.substring(0, 47) + '...'
              : firstSentence;
            return {
              ...context,
              title: title || 'Untitled Context'
            };
          }
          return context;
        });
        
        setContexts(transformedContexts);
      } catch (error) {
        console.error('Error loading contexts:', error);
      } finally {
        setLoading(false);
      }
    }

    loadContexts();
  }, [userId]);

  const handleContextSelect = (contextId: string, checked: boolean) => {
    const newSelectedIds = checked 
      ? [...selectedIds, contextId]
      : selectedIds.filter(id => id !== contextId);
    
    setSelectedIds(newSelectedIds);
    onSelectionChange(newSelectedIds);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = checked ? filteredContexts.map(c => c.id) : [];
    setSelectedIds(newSelectedIds);
    onSelectionChange(newSelectedIds);
  };

  const filteredContexts = contexts.filter(context => {
    const searchLower = searchQuery.toLowerCase();
    return (
      context.title.toLowerCase().includes(searchLower) ||
      context.description?.toLowerCase().includes(searchLower) ||
      context.content.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="relative">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full mb-2" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (contexts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-gray-500">
            You haven&apos;t uploaded any documents yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contexts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={selectedIds.length === filteredContexts.length && filteredContexts.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm text-muted-foreground">
            Select all {filteredContexts.length > 0 && `(${filteredContexts.length})`}
          </label>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContexts.map((context) => (
            <Card key={context.id} className={`relative transition-colors ${selectedIds.includes(context.id) ? 'bg-muted/30' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-4">
                  <Checkbox
                    id={`context-${context.id}`}
                    checked={selectedIds.includes(context.id)}
                    onCheckedChange={(checked) => handleContextSelect(context.id, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{context.title}</CardTitle>
                    {context.description && (
                      <CardDescription className="truncate">{context.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground line-clamp-3 bg-muted/20 rounded-md p-2">
                    {context.content}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Length: {context.content.length} chars</span>
                    <span>Added {new Date(context.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
} 