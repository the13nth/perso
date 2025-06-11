'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, Code, Database, Image, FileText, Activity, Search, GraduationCap, Target } from 'lucide-react';
import { toast } from 'sonner';

interface Tool {
  name: string;
  description: string;
  category: string;
  schema?: any;
  isCustom?: boolean;
  usageCount?: number;
}

const TOOL_CATEGORIES = [
  'Analysis',
  'Generation', 
  'Data',
  'Communication',
  'Automation',
  'Custom'
];

const TOOL_ICONS: Record<string, any> = {
  'document_analysis': FileText,
  'database_query': Database,
  'image_generator': Image,
  'code_interpreter': Code,
  'ubumuntuQuery': Search,
  'getActivitySummary': Activity,
  'trackProgress': Target,
  'analyzeLearning': GraduationCap,
  'searchContext': Search,
  'default': Wrench
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statistics, setStatistics] = useState({
    totalUsage: 0,
    builtInCount: 0,
    customCount: 0
  });
  const [newTool, setNewTool] = useState({
    name: '',
    description: '',
    category: '',
    code: '',
    parameters: ''
  });

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch('/api/tools');
      if (!response.ok) throw new Error('Failed to fetch tools');
      const data = await response.json();
      setTools(data.tools || []);
      setStatistics({
        totalUsage: data.totalUsage || 0,
        builtInCount: data.builtInCount || 0,
        customCount: data.customCount || 0
      });
    } catch (_error) {
      console.error('Error fetching tools:', _error);
      toast.error('Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTool = async () => {
    if (!newTool.name || !newTool.description || !newTool.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTool)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tool');
      }

      const createdTool = await response.json();
      setTools(prev => [...prev, createdTool.tool]);
      setIsCreateModalOpen(false);
      setNewTool({
        name: '',
        description: '',
        category: '',
        code: '',
        parameters: ''
      });
      toast.success('Tool created successfully!');
    } catch (_error) {
      console.error('Error creating tool:', _error);
      toast.error(_error instanceof Error ? _error.message : 'Failed to create tool');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Analysis': 'bg-blue-100 text-blue-800',
      'Generation': 'bg-green-100 text-green-800',
      'Data': 'bg-purple-100 text-purple-800',
      'Communication': 'bg-orange-100 text-orange-800',
      'Automation': 'bg-red-100 text-red-800',
      'Custom': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors['Custom'];
  };

  const getToolIcon = (toolName: string) => {
    const IconComponent = TOOL_ICONS[toolName] || TOOL_ICONS['default'];
    return <IconComponent className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-base sm:text-lg text-foreground">
              Loading tools...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tools</h1>
          <p className="text-muted-foreground">
            Manage and create tools that your agents can use during conversations
          </p>
          {!isLoading && (
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{statistics.builtInCount} built-in tools</span>
              <span>•</span>
              <span>{statistics.customCount} custom tools</span>
              <span>•</span>
              <span>{statistics.totalUsage} total agent assignments</span>
            </div>
          )}
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Tool</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Tool Name</Label>
                  <Input
                    id="name"
                    value={newTool.name}
                    onChange={(e) => setNewTool(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., weather_checker"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newTool.category}
                    onValueChange={(value) => setNewTool(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOL_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTool.description}
                  onChange={(e) => setNewTool(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this tool does..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="parameters">Parameters Schema (JSON)</Label>
                <Textarea
                  id="parameters"
                  value={newTool.parameters}
                  onChange={(e) => setNewTool(prev => ({ ...prev, parameters: e.target.value }))}
                  placeholder='{"location": {"type": "string", "description": "City name"}}'
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="code">Tool Implementation (TypeScript)</Label>
                <Textarea
                  id="code"
                  value={newTool.code}
                  onChange={(e) => setNewTool(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="async function execute(params) { /* implementation */ }"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTool}>
                Create Tool
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, index) => (
          <Card key={index} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getToolIcon(tool.name)}
                  <CardTitle className="text-lg">{tool.name}</CardTitle>
                </div>
                <Badge className={getCategoryColor(tool.category)}>
                  {tool.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {tool.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {tool.isCustom && (
                    <Badge variant="outline" className="text-xs">
                      Custom
                    </Badge>
                  )}
                  {tool.usageCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {tool.usageCount} agent{tool.usageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tools.length === 0 && (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No tools found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first tool
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Tool
          </Button>
        </div>
      )}
    </div>
  );
} 