'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ContextSelector } from '@/components/ContextSelector';
import { useUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

const CATEGORIES = [
  'General Purpose',
  'Research',
  'Data Analysis',
  'Writing',
  'Customer Service',
  'Development',
  'Other'
] as const;

export default function CreateAgentPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    useCases: '',
    triggers: '',
    dataAccess: '',
    isPublic: false,
    contextFiles: [] as File[]
  });

  // Show loading state while auth is being checked
  if (!isLoaded) {
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
      // Create FormData object
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'contextFiles') {
          formData.contextFiles.forEach((file) => {
            submitData.append('contextFiles', file);
          });
        } else if (key === 'triggers') {
          submitData.append(key, typeof value === 'string' ? value.split(',').map((t) => t.trim()).join(',') : '');
        } else {
          submitData.append(key, value.toString());
        }
      });

      // Add selected context IDs
      submitData.append('selectedContextIds', JSON.stringify(selectedContextIds));

      const response = await fetch('/api/agents/create', {
        method: 'POST',
        body: submitData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create agent');
      }

      const data = await response.json();
      toast.success('Agent created successfully!');
      router.push(`/agents/${data.agentId}`);
    } catch (error) {
      console.error('Error creating agent:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData(prev => ({
        ...prev,
        contextFiles: Array.from(e.target.files!)
      }));
    }
  };

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
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Create New Agent
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
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="useCases">Use Cases</Label>
              <Textarea
                id="useCases"
                required
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
                placeholder="e.g., keyword1, keyword2, keyword3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataAccess">Data Access Requirements</Label>
              <Input
                id="dataAccess"
                value={formData.dataAccess}
                onChange={(e) => setFormData(prev => ({ ...prev, dataAccess: e.target.value }))}
                placeholder="What data does this agent need access to?"
              />
            </div>

            <div className="space-y-2">
              <Label>Personal Context</Label>
              <ContextSelector 
                userId={user?.id || ''}
                onSelectionChange={setSelectedContextIds}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contextFiles">Additional Context Files</Label>
              <Input
                id="contextFiles"
                type="file"
                multiple
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                Upload any additional files that provide context for your agent
              </p>
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
              {isSubmitting ? 'Creating Agent...' : 'Create Agent'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 