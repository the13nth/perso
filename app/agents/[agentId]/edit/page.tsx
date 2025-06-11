'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot } from "lucide-react";
import { toast } from 'sonner';

// Predefined categories for agents
const AGENT_CATEGORIES = [
  'Customer Service',
  'Data Analysis',
  'Document Processing',
  'Knowledge Base',
  'Task Automation',
  'Research Assistant',
  'Code Assistant',
  'Content Creation',
  'Other'
];

interface AgentDetails {
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string[];
  isPublic: boolean;
  ownerId: string;
}

export default function EditAgentPage() {
  const { agentId } = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    useCases: '',
    triggers: '',
    isPublic: false
  });

  useEffect(() => {
    async function fetchAgentDetails() {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch agent details');
        }
        const data: AgentDetails = await response.json();
        
        // Check if user is the owner
        if (user?.id !== data.ownerId) {
          toast.error('You are not authorized to edit this agent');
          router.push('/agents');
          return;
        }

        // Set all form data fields
        setFormData({
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          useCases: data.useCases || '',
          triggers: Array.isArray(data.triggers) ? data.triggers.join(', ') : '',
          isPublic: Boolean(data.isPublic)
        });
      } catch (_error) {
        console.error('Error fetching agent details:', _error);
        toast.error('Failed to load agent details');
      } finally {
        setIsLoading(false);
      }
    }

    if (isSignedIn && agentId) {
      fetchAgentDetails();
    }
  }, [agentId, isSignedIn, user?.id, router]);

  // Show loading state while auth is being checked
  if (!isLoaded || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="text-center">
          <div className="text-base sm:text-lg text-foreground">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    redirect('/sign-in');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ownerId: user?.id
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update agent');
      }

      toast.success('Agent updated successfully!');
      router.push(`/agents/${agentId}`);
    } catch (_error) {
      console.error('Error updating agent:', _error);
      toast.error(_error instanceof Error ? _error.message : 'Failed to update agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link href={`/agents/${agentId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agent Details
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Edit Agent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter agent name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what your agent does"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                required
              >
                <option value="">Select a category</option>
                {AGENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="useCases">Use Cases</Label>
              <Textarea
                id="useCases"
                value={formData.useCases}
                onChange={(e) => setFormData(prev => ({ ...prev, useCases: e.target.value }))}
                placeholder="Describe the use cases for this agent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="triggers">Triggers (comma-separated)</Label>
              <Input
                id="triggers"
                value={formData.triggers}
                onChange={(e) => setFormData(prev => ({ ...prev, triggers: e.target.value }))}
                placeholder="Enter triggers separated by commas"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, isPublic: checked }))}
              />
              <Label htmlFor="isPublic">Make this agent public</Label>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Updating Agent...' : 'Update Agent'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 