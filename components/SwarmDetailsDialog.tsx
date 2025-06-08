"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, 
  Clock, 
  Users, 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Heart,
  BarChart3,
  RefreshCw,
  Loader2,
  Target,
  Zap
} from "lucide-react";
import { toast } from "sonner";

interface SwarmDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swarm: any | null;
}

interface DetailedSwarmData {
  sessionId: string;
  status: string;
  progress: number;
  agents: string[];
  coordinatorAgent: string;
  task: {
    id: string;
    description: string;
    type: string;
    priority: string;
    subTasks: Array<{
      id: string;
      description: string;
      status: string;
      assignedAgentId?: string;
      estimatedDuration: number;
      actualDuration?: number;
      result?: any;
    }>;
  };
  createdAt: number;
  lastActivity: number;
  completedAt?: number;
  messageCount: number;
  results: any[];
  health: {
    overall: string;
    agentHealth: Array<{
      agentId: string;
      status: string;
      responseTime: number;
      taskLoad: number;
      errorRate: number;
      lastActivity: number;
    }>;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      timestamp: number;
    }>;
    recommendations: string[];
  };
  performanceMetrics?: {
    totalDuration: number;
    communicationEfficiency: number;
    taskCompletionRate: number;
    collaborationScore: number;
  };
}

export function SwarmDetailsDialog({ open, onOpenChange, swarm }: SwarmDetailsDialogProps) {
  const [detailedData, setDetailedData] = useState<DetailedSwarmData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch detailed swarm data
  const fetchDetailedData = useCallback(async () => {
    if (!swarm?.sessionId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/swarms/${swarm.sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setDetailedData(data.session);
      } else {
        toast.error('Failed to load swarm details');
      }
    } catch (error) {
      console.error('Error fetching swarm details:', error);
      toast.error('Failed to load swarm details');
    } finally {
      setLoading(false);
    }
  }, [swarm?.sessionId]);

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await fetchDetailedData();
    setRefreshing(false);
    toast.success('Swarm data refreshed');
  };

  // Auto-refresh every 10 seconds when dialog is open
  useEffect(() => {
    if (open && swarm) {
      fetchDetailedData();
      const interval = setInterval(fetchDetailedData, 10000);
      return () => clearInterval(interval);
    }
  }, [open, swarm, fetchDetailedData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white';
      case 'forming': return 'bg-blue-500 text-white';
      case 'completing': return 'bg-yellow-500 text-white';
      case 'completed': return 'bg-gray-500 text-white';
      case 'dissolved': return 'bg-gray-400 text-white';
      case 'error': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };


  if (!swarm) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Swarm Details
              </DialogTitle>
              <DialogDescription className="mt-2">
                Real-time monitoring and management for agent swarm
              </DialogDescription>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : detailedData ? (
          <Tabs defaultValue={detailedData.progress === 100 && detailedData.status === 'completed' ? 'final' : 'overview'} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="final" disabled={!(detailedData.progress === 100 && detailedData.status === 'completed')}>Final Answer</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
            </TabsList>

            <TabsContent value="final" className="space-y-4">
              {detailedData.progress === 100 && detailedData.status === 'completed' && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      🎯 Final Answer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-white rounded-lg border">
                        <p className="text-sm font-medium text-green-800 mb-2">Final Answer:</p>
                        {(() => {
                          const lastCompleted = [...detailedData.task.subTasks].reverse().find(task => task.result && task.status === 'completed');
                          let displayResult = lastCompleted?.result;
                          if (typeof displayResult === 'string') {
                            try {
                              const parsed = JSON.parse(displayResult);
                              if (parsed.agentResponse) displayResult = parsed.agentResponse;
                            } catch (e) {}
                          }
                          return (
                            <div className="p-3 bg-gray-50 rounded-md border-l-4 border-green-500">
                              <p className="text-xs font-medium text-gray-600 mb-1">
                                {lastCompleted ? lastCompleted.description : 'No final answer available'}
                              </p>
                              <p className="text-sm text-gray-800">
                                {typeof displayResult === 'string' ? displayResult : JSON.stringify(displayResult)}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="overview" className="space-y-4">
              {/* Status and Progress */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Status & Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(detailedData.status)}>
                        {detailedData.status.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatTimeAgo(detailedData.lastActivity)}
                      </span>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Overall Progress</span>
                        <span>{detailedData.progress}%</span>
                      </div>
                      <Progress value={detailedData.progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span>{detailedData.agents.length} agents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span>{detailedData.messageCount} messages</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDuration(Date.now() - detailedData.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span>{detailedData.task.subTasks.length} tasks</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Swarm Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getHealthColor(detailedData.health.overall)}>
                        {detailedData.health.overall.toUpperCase()}
                      </Badge>
                    </div>

                    {detailedData.health.issues.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Active Issues:</p>
                        {detailedData.health.issues.slice(0, 3).map((issue, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                            <div>
                              <Badge className={getSeverityColor(issue.severity)} variant="secondary">
                                {issue.severity}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {issue.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>No issues detected</span>
                      </div>
                    )}

                    {detailedData.health.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {detailedData.health.recommendations.slice(0, 2).map((rec, index) => (
                            <li key={index}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Task Description */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Task Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm">{detailedData.task.description}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{detailedData.task.type.replace('_', ' ')}</Badge>
                      <Badge variant={detailedData.task.priority === 'high' ? 'destructive' : 'secondary'}>
                        {detailedData.task.priority}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              {detailedData.performanceMetrics && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Completion Rate</p>
                        <p className="font-medium">{Math.round(detailedData.performanceMetrics.taskCompletionRate)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Communication</p>
                        <p className="font-medium">{Math.round(detailedData.performanceMetrics.communicationEfficiency)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Collaboration</p>
                        <p className="font-medium">{Math.round(detailedData.performanceMetrics.collaborationScore)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium">{formatDuration(detailedData.performanceMetrics.totalDuration)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              <div className="space-y-3">
                {detailedData.task.subTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={task.status === 'completed' ? 'default' : 
                                      task.status === 'in_progress' ? 'secondary' : 'outline'}
                            >
                              {task.status.replace('_', ' ')}
                            </Badge>
                            {task.assignedAgentId && (
                              <Badge variant="outline" className="text-xs">
                                Agent: {task.assignedAgentId.slice(0, 8)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{task.description}</p>
                          {task.result && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-md">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Result:</p>
                              <p className="text-xs">{typeof task.result === 'string' ? task.result : JSON.stringify(task.result)}</p>
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Est: {task.estimatedDuration}min</p>
                          {task.actualDuration && (
                            <p>Actual: {task.actualDuration}min</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="health" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Health Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Health Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Overall Health</span>
                        <Badge variant="outline" className={getHealthColor(detailedData.health.overall)}>
                          {detailedData.health.overall}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Active Issues ({detailedData.health.issues.length})</p>
                        {detailedData.health.issues.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No issues detected</p>
                        ) : (
                          detailedData.health.issues.map((issue, index) => (
                            <div key={index} className="border rounded p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getSeverityColor(issue.severity)} variant="secondary">
                                  {issue.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{issue.type}</span>
                              </div>
                              <p className="text-xs">{issue.description}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detailedData.health.recommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recommendations available</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {detailedData.health.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="agents" className="space-y-4">
              <div className="space-y-3">
                {detailedData.health.agentHealth.map((agent) => (
                  <Card key={agent.agentId}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span className="font-medium text-sm">
                            {agent.agentId.slice(0, 12)}...
                          </span>
                          {agent.agentId === detailedData.coordinatorAgent && (
                            <Badge variant="secondary" className="text-xs">Coordinator</Badge>
                          )}
                        </div>
                        <Badge 
                          className={agent.status === 'active' ? 'bg-green-500 text-white' : 
                                    agent.status === 'idle' ? 'bg-yellow-500 text-white' : 
                                    agent.status === 'overloaded' ? 'bg-orange-500 text-white' :
                                    'bg-red-500 text-white'}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Response Time</p>
                          <p className="font-medium">{Math.round(agent.responseTime)}ms</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Task Load</p>
                          <p className="font-medium">{agent.taskLoad} tasks</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Error Rate</p>
                          <p className="font-medium">{agent.errorRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Activity</p>
                          <p className="font-medium">{formatTimeAgo(agent.lastActivity)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load swarm details</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 