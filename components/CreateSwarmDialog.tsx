"use client";

import { useState } from "react";
import Select, { StylesConfig } from "react-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, 
  Brain, 
  Users, 
  Target,
  CheckCircle,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface CreateSwarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwarmCreated: () => void;
}

interface TaskComplexityAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  recommendedAgentCount: number;
  estimatedDuration: number;
  suggestedTaskType: string;
  requiredCapabilities: string[];
  reasoning: string;
}

interface SelectOption {
  value: string;
  label: string;
}

export function CreateSwarmDialog({ open, onOpenChange, onSwarmCreated }: CreateSwarmDialogProps) {
  const [formData, setFormData] = useState({
    taskDescription: '',
    taskType: '',
    priority: 'medium',
    deadline: '',
    requirements: [] as Array<{type: string, value: string, importance: string}>,
    constraints: [] as Array<{type: string, description: string}>,
    expectedOutputFormat: 'text'
  });

  const [step, setStep] = useState(1); // Multi-step form
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [complexityAnalysis, setComplexityAnalysis] = useState<TaskComplexityAnalysis | null>(null);

  // Custom styles for react-select to match UI theme
  const customSelectStyles: StylesConfig<SelectOption, false> = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '40px',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      backgroundColor: 'hsl(var(--background))',
      '&:hover': {
        borderColor: 'hsl(var(--border))'
      },
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring))' : 'none',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))'
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'hsl(var(--accent))' 
        : state.isFocused 
          ? 'hsl(var(--accent) / 0.5)' 
          : 'transparent',
      color: 'hsl(var(--foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--accent))'
      }
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'hsl(var(--foreground))'
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'hsl(var(--muted-foreground))'
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px'
    })
  };

  // Analyze task complexity using AI
  const analyzeTaskComplexity = async () => {
    if (!formData.taskDescription.trim()) {
      toast.error('Please enter a task description first');
      return;
    }

    setAnalyzing(true);
    try {
      // Simulate AI analysis with intelligent defaults
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const description = formData.taskDescription.toLowerCase();
      let complexity: TaskComplexityAnalysis['complexity'] = 'simple';
      let recommendedAgentCount = 2;
      let estimatedDuration = 15;
      let suggestedTaskType = 'processing';
      let requiredCapabilities: string[] = ['general_processing'];
      let reasoning = 'Basic task requiring minimal coordination.';

      // Intelligent analysis based on keywords and patterns
      const complexKeywords = ['analyze', 'research', 'compare', 'integrate', 'synthesize', 'optimize'];
      const multiDomainKeywords = ['fitness', 'finance', 'health', 'business', 'data', 'content'];
      const analysisKeywords = ['analysis', 'report', 'insights', 'trends', 'patterns'];
      const generationKeywords = ['create', 'generate', 'write', 'design', 'build'];

      const hasComplexTasks = complexKeywords.some(keyword => description.includes(keyword));
      const hasMultipleDomains = multiDomainKeywords.filter(keyword => description.includes(keyword)).length > 1;
      const isAnalysisTask = analysisKeywords.some(keyword => description.includes(keyword));
      const isGenerationTask = generationKeywords.some(keyword => description.includes(keyword));

      if (hasMultipleDomains && hasComplexTasks) {
        complexity = 'very_complex';
        recommendedAgentCount = 4;
        estimatedDuration = 45;
        suggestedTaskType = 'multi_domain';
        requiredCapabilities = ['data_analysis', 'integration', 'coordination', 'domain_expertise'];
        reasoning = 'Multi-domain task requiring specialized agents and complex coordination.';
      } else if (hasComplexTasks || hasMultipleDomains) {
        complexity = 'complex';
        recommendedAgentCount = 3;
        estimatedDuration = 30;
        suggestedTaskType = isAnalysisTask ? 'analysis' : 'processing';
        requiredCapabilities = ['data_analysis', 'pattern_recognition', 'collaboration'];
        reasoning = 'Complex task requiring multiple specialized agents working together.';
      } else if (isAnalysisTask || isGenerationTask) {
        complexity = 'moderate';
        recommendedAgentCount = 2;
        estimatedDuration = 20;
        suggestedTaskType = isAnalysisTask ? 'analysis' : 'generation';
        requiredCapabilities = isAnalysisTask ? ['data_analysis', 'insights'] : ['content_generation', 'creativity'];
        reasoning = 'Moderate complexity requiring specialized capabilities.';
      }

      const analysis: TaskComplexityAnalysis = {
        complexity,
        recommendedAgentCount,
        estimatedDuration,
        suggestedTaskType,
        requiredCapabilities,
        reasoning
      };

      setComplexityAnalysis(analysis);
      
      // Auto-fill suggested values
      setFormData(prev => ({
        ...prev,
        taskType: suggestedTaskType,
        requirements: requiredCapabilities.map(cap => ({
          type: 'capability',
          value: cap,
          importance: 'required'
        }))
      }));

      toast.success('Task complexity analyzed successfully!');
      setStep(2);
    } catch (error) {
      console.error('Error analyzing task:', error);
      toast.error('Failed to analyze task complexity');
    } finally {
      setAnalyzing(false);
    }
  };

  // Create the swarm
  const createSwarm = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/swarms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Swarm created with ${data.session.agentCount} agents!`);
        onSwarmCreated();
        onOpenChange(false);
        resetForm();
      } else {
        toast.error(data.error || 'Failed to create swarm');
      }
    } catch (error) {
      console.error('Error creating swarm:', error);
      toast.error('Failed to create swarm');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      taskDescription: '',
      taskType: '',
      priority: 'medium',
      deadline: '',
      requirements: [],
      constraints: [],
      expectedOutputFormat: 'text'
    });
    setStep(1);
    setComplexityAnalysis(null);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-blue-100 text-blue-800';
      case 'complex': return 'bg-orange-100 text-orange-800';
      case 'very_complex': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Create Agent Swarm
          </DialogTitle>
          <DialogDescription>
            Describe your complex task and let AI form the optimal agent team
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Task Description</Label>
              <Textarea
                id="taskDescription"
                placeholder="Describe the complex task you want the agent swarm to tackle. Be specific about what you want to achieve..."
                value={formData.taskDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, taskDescription: e.target.value }))}
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">
                The more detailed your description, the better the AI can analyze and form the optimal team.
              </p>
            </div>

            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI-Powered Task Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Our AI will analyze your task to determine complexity, recommend the optimal number of agents, 
                  and suggest the best collaboration strategy.
                </p>
                <Button 
                  onClick={analyzeTaskComplexity}
                  disabled={!formData.taskDescription.trim() || analyzing}
                  className="w-full"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing Task Complexity...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze & Continue
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && complexityAnalysis && (
          <div className="space-y-6">
            {/* Complexity Analysis Results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Task Analysis Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={getComplexityColor(complexityAnalysis.complexity)}>
                    {complexityAnalysis.complexity.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {complexityAnalysis.recommendedAgentCount} agents recommended
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    ~{complexityAnalysis.estimatedDuration}min estimated
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {complexityAnalysis.reasoning}
                </p>

                <div>
                  <p className="text-sm font-medium mb-2">Required Capabilities:</p>
                  <div className="flex flex-wrap gap-2">
                    {complexityAnalysis.requiredCapabilities.map((capability, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {capability.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taskType">Task Type</Label>
                <Select<SelectOption, false>
                  value={formData.taskType ? { value: formData.taskType, label: formData.taskType.charAt(0).toUpperCase() + formData.taskType.slice(1).replace('_', '-') } : null}
                  onChange={(selectedOption) => setFormData(prev => ({ ...prev, taskType: selectedOption?.value || '' }))}
                  options={[
                    { value: 'analysis', label: 'Analysis' },
                    { value: 'generation', label: 'Generation' },
                    { value: 'processing', label: 'Processing' },
                    { value: 'multi_domain', label: 'Multi-Domain' },
                    { value: 'workflow', label: 'Workflow' }
                  ]}
                  placeholder="Select task type"
                  styles={customSelectStyles}
                  isClearable
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select<SelectOption, false>
                  value={{ value: formData.priority, label: formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1) }}
                  onChange={(selectedOption) => setFormData(prev => ({ ...prev, priority: selectedOption?.value || 'medium' }))}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' }
                  ]}
                  styles={customSelectStyles}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (Optional)</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outputFormat">Expected Output Format</Label>
              <Select<SelectOption, false>
                value={{ 
                  value: formData.expectedOutputFormat, 
                  label: formData.expectedOutputFormat === 'text' ? 'Text' : 
                         formData.expectedOutputFormat === 'structured' ? 'Structured Data' : 
                         formData.expectedOutputFormat === 'visual' ? 'Visual/Charts' : 'Mixed Format' 
                }}
                onChange={(selectedOption) => setFormData(prev => ({ ...prev, expectedOutputFormat: selectedOption?.value || 'text' }))}
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'structured', label: 'Structured Data' },
                  { value: 'visual', label: 'Visual/Charts' },
                  { value: 'mixed', label: 'Mixed Format' }
                ]}
                styles={customSelectStyles}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          
          <Button 
            onClick={step === 1 ? analyzeTaskComplexity : createSwarm}
            disabled={loading || analyzing || (step === 1 && !formData.taskDescription.trim())}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Swarm...
              </>
            ) : step === 1 ? (
              'Analyze Task'
            ) : (
              'Create Swarm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 