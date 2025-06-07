"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Bot, 
  Plus, 
  Users, 
  Activity, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Trash2,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { CreateSwarmDialog } from "@/components/CreateSwarmDialog";
import { SwarmDetailsDialog } from "@/components/SwarmDetailsDialog";

interface SwarmSession {
  sessionId: string;
  status: 'forming' | 'active' | 'completing' | 'completed' | 'dissolved' | 'error';
  progress: number;
  task: {
    id: string;
    description: string;
    type: string;
    priority: string;
  };
  agentCount: number;
  coordinatorAgent: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  estimatedDuration: number;
  timeElapsed: number;
}

interface SwarmStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  averageProgress: number;
  totalAgentsUsed: number;
  totalMessages: number;
}

export default function SwarmsPage() {
  const [swarms, setSwarms] = useState<SwarmSession[]>([]);
  const [stats, setStats] = useState<SwarmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSwarm, setSelectedSwarm] = useState<SwarmSession | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch swarms and stats
  const fetchSwarms = async () => {
    try {
      console.log('🔍 Fetching swarms...');
      const response = await fetch('/api/swarms');
      const data = await response.json();
      
      console.log('📊 API Response:', data);
      console.log('📋 Sessions:', data.sessions);
      console.log('📈 Stats:', data.stats);
      
      if (data.success) {
        setSwarms(data.sessions);
        setStats(data.stats);
        console.log('✅ Swarms state updated:', data.sessions.length, 'sessions');
      } else {
        console.error('❌ API returned error:', data.error);
        toast.error('Failed to load swarms');
      }
    } catch (error) {
      console.error('Error fetching swarms:', error);
      toast.error('Failed to load swarms');
    } finally {
      setLoading(false);
    }
  };

  // Delete swarm
  const deleteSwarm = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/swarms/${sessionId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Swarm dissolved successfully');
        fetchSwarms(); // Refresh the list
      } else {
        toast.error(data.error || 'Failed to dissolve swarm');
      }
    } catch (error) {
      console.error('Error dissolving swarm:', error);
      toast.error('Failed to dissolve swarm');
    }
  };

  // View swarm details
  const viewSwarmDetails = (swarm: SwarmSession) => {
    setSelectedSwarm(swarm);
    setDetailsDialogOpen(true);
  };

  // Auto-refresh swarms every 30 seconds
  useEffect(() => {
    fetchSwarms();
    const interval = setInterval(fetchSwarms, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'forming': return 'bg-blue-500';
      case 'completing': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      case 'dissolved': return 'bg-gray-400';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayCircle className="h-4 w-4" />;
      case 'forming': return <Bot className="h-4 w-4" />;
      case 'completing': return <PauseCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'dissolved': return <PauseCircle className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
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
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="container py-6 space-y-6 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8" />
            Agent Swarms
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage intelligent agent teams for complex tasks
          </p>
        </div>
        
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          size="lg"
          className="gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Swarm
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Swarms</p>
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Now</p>
                  <p className="text-2xl font-bold">{stats.activeSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agents Used</p>
                  <p className="text-2xl font-bold">{stats.totalAgentsUsed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Progress</p>
                  <p className="text-2xl font-bold">{stats.averageProgress}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Swarms List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Swarms</h2>
        
        {(() => {
          console.log('🎨 Rendering swarms section, swarms length:', swarms.length);
          console.log('🎨 Swarms array:', swarms);
          return null;
        })()}
        
        {swarms.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No swarms yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first agent swarm to tackle complex multi-step tasks
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Swarm
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {swarms.map((swarm) => (
              <Card key={swarm.sessionId} className={`hover:shadow-md transition-shadow ${
                swarm.status === 'completed' && swarm.progress === 100 
                  ? 'border-green-200 bg-green-50/30' 
                  : ''
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(swarm.status)} text-white`}
                        >
                          {getStatusIcon(swarm.status)}
                          <span className="ml-1 capitalize">{swarm.status}</span>
                        </Badge>
                        
                        {/* Results Ready Indicator */}
                        {swarm.status === 'completed' && swarm.progress === 100 && (
                          <Badge className="bg-green-600 text-white animate-pulse">
                            🎯 Results Ready
                          </Badge>
                        )}
                        
                        <Badge variant="outline" className="capitalize">
                          {swarm.task.type.replace('_', ' ')}
                        </Badge>
                        
                        <Badge 
                          variant={swarm.task.priority === 'high' ? 'destructive' : 
                                  swarm.task.priority === 'medium' ? 'default' : 'secondary'}
                        >
                          {swarm.task.priority}
                        </Badge>
                      </div>
                      
                      <h3 className="font-medium text-sm leading-tight">
                        {swarm.task.description}
                      </h3>
                      
                      {/* Completion Message */}
                      {swarm.status === 'completed' && swarm.progress === 100 && (
                        <p className="text-xs text-green-700 mt-1 font-medium">
                          ✅ All tasks completed successfully! Click to view final answer.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 ml-3">
                      <Button
                        variant={swarm.status === 'completed' && swarm.progress === 100 ? "default" : "ghost"}
                        size="sm"
                        onClick={() => viewSwarmDetails(swarm)}
                        className={swarm.status === 'completed' && swarm.progress === 100 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : ""}
                      >
                        <Eye className="h-4 w-4" />
                        {swarm.status === 'completed' && swarm.progress === 100 ? " View Results" : ""}
                      </Button>
                      
                      {swarm.status !== 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSwarm(swarm.sessionId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>{swarm.progress}%</span>
                    </div>
                    <Progress value={swarm.progress} className="h-2" />
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span>{swarm.agentCount} agents</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span>{swarm.messageCount} messages</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDuration(swarm.timeElapsed)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{formatTimeAgo(swarm.lastActivity)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateSwarmDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSwarmCreated={fetchSwarms}
      />
      
      <SwarmDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        swarm={selectedSwarm}
      />
    </div>
  );
} 