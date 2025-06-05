'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bot, Tag, Calendar, User, Globe, Lock, Edit } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

interface AgentDetails {
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string[];
  isPublic: boolean;
  createdAt: number;
  ownerId: string;
  selectedContextIds?: string[];
}

interface Category {
  name: string;
  count: number;
}

function FormattedDate({ date }: { date: number }) {
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    setFormattedDate(new Date(date).toLocaleDateString());
  }, [date]);

  return <span>{formattedDate}</span>;
}

export default function AgentDetailsPage() {
  const { agentId } = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function fetchAgentDetails() {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch agent details');
        }
        const data = await response.json();
        setAgent(data);
        setSelectedCategories(data.selectedContextIds || []);
      } catch (error) {
        console.error('Error fetching agent details:', error);
        toast.error('Failed to load agent details');
      } finally {
        setIsLoading(false);
      }
    }

    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  useEffect(() => {
    async function fetchAvailableCategories() {
      try {
        const response = await fetch('/api/retrieval/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setAvailableCategories(data.categories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }
    fetchAvailableCategories();
  }, []);

  const handleUpdateCategories = async () => {
    if (!agent) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...agent,
          selectedContextIds: selectedCategories,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update categories');
      }

      const updatedAgent = await response.json();
      setAgent(updatedAgent);
      setIsEditingCategories(false);
      toast.success('Categories updated successfully!');
    } catch (error) {
      console.error('Error updating categories:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update categories');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="container py-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-base sm:text-lg text-foreground">
              Loading...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container py-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-base sm:text-lg text-foreground">
              Agent not found
            </div>
            <Button
              variant="link"
              onClick={() => router.push('/agents')}
              className="mt-4"
            >
              Back to Agents
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = isSignedIn && user?.id === agent.ownerId;

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link href="/agents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agents
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                {agent.name}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="w-4 h-4" />
                {agent.category}
                {agent.isPublic ? (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    Public
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4" />
                    Private
                  </div>
                )}
              </div>
            </div>
            {isOwner && (
              <Button variant="outline" onClick={() => router.push(`/agents/${agentId}/edit`)}>
                Edit Agent
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">Description</h3>
            <p className="text-muted-foreground">{agent.description}</p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Use Cases</h3>
            <p className="text-muted-foreground">{agent.useCases}</p>
          </div>

          {agent.triggers.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Triggers</h3>
              <div className="flex flex-wrap gap-2">
                {agent.triggers.map((trigger, index) => (
                  <div
                    key={index}
                    className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                  >
                    {trigger}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Available Categories</h3>
              {isOwner && (
                <Dialog open={isEditingCategories} onOpenChange={setIsEditingCategories}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Categories
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Categories</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label className="text-sm font-medium mb-3 block">
                        Select categories this agent can access:
                      </Label>
                      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {availableCategories.map((category) => (
                          <div key={category.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`category-${category.name}`}
                              checked={selectedCategories.includes(category.name)}
                              onCheckedChange={() => toggleCategory(category.name)}
                            />
                            <Label 
                              htmlFor={`category-${category.name}`} 
                              className="flex-1 text-sm cursor-pointer"
                            >
                              {category.name}
                              <span className="text-xs text-muted-foreground ml-1">({category.count})</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSelectedCategories(agent.selectedContextIds || []);
                          setIsEditingCategories(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateCategories} disabled={isUpdating}>
                        {isUpdating ? 'Updating...' : 'Update Categories'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {agent.selectedContextIds && agent.selectedContextIds.length > 0 ? (
              <div>
                <div className="flex flex-wrap gap-2">
                  {agent.selectedContextIds.map((contextId, index) => (
                    <div
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                    >
                      {contextId}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These are the knowledge categories this agent can access for generating insights and responses.
                </p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No categories selected. {isOwner && 'Click "Edit Categories" to select knowledge categories for this agent.'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Created <FormattedDate date={agent.createdAt} />
            </div>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {isOwner ? 'You are the owner' : 'Created by another user'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}