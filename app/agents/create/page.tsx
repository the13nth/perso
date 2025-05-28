'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Globe, BookOpen, LineChart, Pencil, Headset, Code, Boxes, Wallet, Dumbbell, Activity, StickyNote, Cpu, Brain, Building2, Gamepad, ClipboardCheck } from "lucide-react";
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

// Function to get icon for category
function getCategoryIcon(categoryName: string) {
  const icons = {
    'General': <Globe className="w-4 h-4" />,
    'Education': <BookOpen className="w-4 h-4" />,
    'Data Analysis': <LineChart className="w-4 h-4" />,
    'Writing': <Pencil className="w-4 h-4" />,
    'Customer Service': <Headset className="w-4 h-4" />,
    'Development': <Code className="w-4 h-4" />,
    'Other': <Boxes className="w-4 h-4" />,
    'Finance': <Wallet className="w-4 h-4" />,
    'Fitness': <Dumbbell className="w-4 h-4" />,
    'Health': <Activity className="w-4 h-4" />,
    'Notes': <StickyNote className="w-4 h-4" />,
    'AI': <Cpu className="w-4 h-4" />,
    'Research': <Brain className="w-4 h-4" />,
    'Business': <Building2 className="w-4 h-4" />,
    'Gaming': <Gamepad className="w-4 h-4" />,
    'Analytics': <LineChart className="w-4 h-4" />,
    'Tasks': <ClipboardCheck className="w-4 h-4" />,
  };
  return icons[categoryName as keyof typeof icons] || <Bot className="w-4 h-4" />;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    useCases: '',
    triggers: '',
    isPublic: false
  });

  // Fetch available embedding categories when component mounts
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/retrieval/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setAvailableCategories(data.categories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load available categories');
      }
    }
    fetchCategories();
  }, []);

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
      const response = await fetch('/api/agents/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          selectedCategories
        }),
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
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
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
                placeholder="Describe specific use cases for this agent"
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
              <Label>Knowledge Categories</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableCategories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => {
                      setSelectedCategories(prev => 
                        prev.includes(category.name)
                          ? prev.filter(c => c !== category.name)
                          : [...prev, category.name]
                      );
                    }}
                    className={`p-4 text-sm rounded-lg transition-colors flex items-center ${
                      selectedCategories.includes(category.name)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center flex-1">
                      <span className="mr-2">{getCategoryIcon(category.name)}</span>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <span className="ml-2 bg-muted/20 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Select categories to give your agent access to relevant knowledge
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