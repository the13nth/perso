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
        setContexts(data.contexts);
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
      <div className="space-y-4">
        <Skeleton className="h-[150px] w-full" />
        <Skeleton className="h-[150px] w-full" />
        <Skeleton className="h-[150px] w-full" />
      </div>
    );
  }

  if (contexts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No personal context available. Add some context first to enhance your agent's knowledge.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contexts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center space-x-2 py-2">
        <Checkbox
          id="select-all"
          checked={selectedIds.length === filteredContexts.length && filteredContexts.length > 0}
          onCheckedChange={handleSelectAll}
        />
        <label htmlFor="select-all" className="text-sm text-muted-foreground">
          Select all {filteredContexts.length > 0 && `(${filteredContexts.length})`}
        </label>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {filteredContexts.map((context) => (
            <Card key={context.id} className="relative">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <Checkbox
                    id={`context-${context.id}`}
                    checked={selectedIds.includes(context.id)}
                    onCheckedChange={(checked) => handleContextSelect(context.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{context.title}</CardTitle>
                    {context.description && (
                      <CardDescription>{context.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {context.content}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  Added {new Date(context.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
} 