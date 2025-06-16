'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Loader2, ExternalLink, AlertCircle, RefreshCw, Rocket, Activity, Brain, Zap, LayoutDashboard, User, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AgentMetadata } from "@/lib/pinecone";
import { useAuth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { Progress } from "@/components/ui/progress";
import { AgentRunMetrics } from '@/lib/services/agent-runner';
import { AgentResultsDialog } from '@/app/components/AgentResultsDialog';
import { Avatar } from "@/app/components/ui/avatar";
import { Eye, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentMetrics {
  successRate: number;
  totalRuns: number;
  averageResponseTime: number;
  status: 'idle' | 'running' | 'completed' | 'error';
}

interface DashboardMetrics {
  totalAgents: number;
  activeAgents: number;
  totalRuns: number;
  overallSuccess: number;
}

interface AgentCardProps {
  agent: AgentMetadata;
}

function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="group relative flex flex-col hover:border-primary/50 hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
          <Bot className="h-5 w-5" aria-hidden="true" />
          <span className="truncate">{agent.name}</span>
          {agent.isPublic && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              Public
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="line-clamp-2">{agent.description || "No description provided"}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {agent.category && (
              <Badge variant="outline" className="font-normal">
                {agent.category}
              </Badge>
            )}
            {agent.triggers && agent.triggers.length > 0 && (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {agent.triggers.length} trigger{agent.triggers.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {agent.useCases && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {agent.useCases}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-4 flex gap-2">
        <Link href={`/agents/${agent.agentId}`} className="flex-1">
          <Button className="w-full group-hover:bg-primary/90 transition-colors" size="sm">
            View Agent
            <ExternalLink className="w-4 h-4 ml-2 opacity-70" aria-hidden="true" />
          </Button>
        </Link>
        <Link 
          href={`/agent-chat?agentId=${agent.agentId}&agentName=${encodeURIComponent(agent.name)}&agentDescription=${encodeURIComponent(agent.description || '')}`} 
          className="flex-1"
        >
          <Button variant="outline" className="w-full" size="sm">
            Chat
            <Bot className="w-4 h-4 ml-2 opacity-70" aria-hidden="true" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function EmptyState({ type, onCreateClick }: { type: 'user' | 'public', onCreateClick?: () => void }) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-6">
        <div className="text-center space-y-2">
          <Bot className="h-8 w-8 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            {type === 'user' 
              ? "You haven't created any agents yet" 
              : "No public agents available"}
          </p>
          {type === 'user' && onCreateClick && (
            <Button variant="outline" className="mt-2" onClick={onCreateClick}>
              Create your first agent
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState({ type }: { type: 'user' | 'public' }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" aria-hidden="true" />
      <p>Loading {type === 'user' ? 'your' : 'public'} agents...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string, onRetry: () => void }) {
  return (
    <Card className="border-destructive">
      <CardContent className="pt-6">
        <div className="text-center space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" aria-hidden="true" />
          <p className="text-lg font-medium text-destructive">{message}</p>
          <Button 
            variant="outline" 
            onClick={onRetry}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardCard({ title, value, icon: Icon, description, trend }: { 
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        {trend && (
          <div className={`text-xs mt-1 flex items-center ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgentMetricsCard({ agent, metrics }: { agent: AgentMetadata; metrics: AgentRunMetrics }) {
  const [showResults, setShowResults] = useState(false);

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {agent.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Success Rate</span>
            <span className="text-sm font-medium">{metrics.successRate}%</span>
          </div>
          <Progress value={metrics.successRate} className="h-1" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <div className="text-sm font-medium">{metrics.totalRuns}</div>
              <div className="text-xs text-muted-foreground">Total Runs</div>
            </div>
            <div>
              <div className="text-sm font-medium">{metrics.averageResponseTime}ms</div>
              <div className="text-xs text-muted-foreground">Avg. Response</div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-2 flex gap-2">
          <Badge 
            variant={metrics.status === 'running' ? 'default' : metrics.status === 'completed' ? 'outline' : 'secondary'}
            className="flex-1 justify-center"
          >
            {metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1)}
          </Badge>
          {metrics.status === 'completed' && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1"
              onClick={() => setShowResults(true)}
            >
              View Results
            </Button>
          )}
        </CardFooter>
      </Card>

      <AgentResultsDialog
        open={showResults}
        onOpenChange={setShowResults}
        agent={agent}
        metrics={metrics}
      />
    </>
  );
}

function AgentsContent() {
  const [publicAgents, setPublicAgents] = useState<AgentMetadata[]>([]);
  const [userAgents, setUserAgents] = useState<AgentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isLaunching, setIsLaunching] = useState(false);
  const [agentMetrics, setAgentMetrics] = useState<Record<string, AgentRunMetrics>>({});
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    totalAgents: 0,
    activeAgents: 0,
    totalRuns: 0,
    overallSuccess: 0
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [publicRes, userRes] = await Promise.all([
        fetch('/api/agents/public', { 
          headers: { 'Cache-Control': 'no-cache' } 
        }),
        fetch('/api/agents/user', { 
          headers: { 'Cache-Control': 'no-cache' } 
        })
      ]);

      if (!publicRes.ok) {
        throw new Error(`Failed to fetch public agents: ${publicRes.status}`);
      }

      if (!userRes.ok) {
        throw new Error(`Failed to fetch user agents: ${userRes.status}`);
      }

      const [publicData, userData] = await Promise.all([
        publicRes.json(),
        userRes.json()
      ]);

      const validPublicAgents = Array.isArray(publicData.agents) 
        ? publicData.agents.filter(Boolean)
        : [];
      
      const validUserAgents = Array.isArray(userData.agents)
        ? userData.agents.filter(Boolean)
        : [];

      // Sort agents by name
      validPublicAgents.sort((a: AgentMetadata, b: AgentMetadata) => a.name.localeCompare(b.name));
      validUserAgents.sort((a: AgentMetadata, b: AgentMetadata) => a.name.localeCompare(b.name));

      setPublicAgents(validPublicAgents);
      setUserAgents(validUserAgents);
    } catch (_error) {
      console.error('Error loading agents:', _error);
      setError(_error instanceof Error ? _error.message : 'Failed to load agents');
      toast.error('Failed to load agents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const launchAllAgents = async () => {
    if (userAgents.length === 0) {
      toast.error('No agents available to launch');
      return;
    }

    setIsLaunching(true);
    try {
      const response = await fetch('/api/agents/chain/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agents: userAgents
        })
      });

      if (!response.ok) {
        throw new Error('Failed to launch agents');
      }

      const result = await response.json();
      
      setAgentMetrics(result.metrics);
      setDashboardMetrics({
        totalAgents: userAgents.length,
        activeAgents: result.activeAgents,
        totalRuns: result.totalRuns,
        overallSuccess: result.overallSuccess
      });

      toast.success('All agents launched successfully!');
    } catch (error) {
      console.error('Error launching agents:', error);
      toast.error('Failed to launch agents');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setIsMobileMenuOpen(false); // Close mobile menu when tab changes
  };

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ErrorState message={error} onRetry={fetchAgents} />
      </div>
    );
  }

  return (
    <div className="container py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">AI Agents Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Monitor and manage your AI agents
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button 
            size="sm" 
            className="w-full sm:w-auto" 
            variant="outline"
            onClick={launchAllAgents}
            disabled={isLaunching || userAgents.length === 0}
          >
            <Rocket className="w-4 h-4 mr-2" />
            {isLaunching ? 'Launching...' : 'Launch All Agents'}
          </Button>
          <Link href="/agents/create">
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </Link>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={handleTabChange} 
        className="space-y-4"
      >
        <div className={cn(
          "border-b transition-all duration-200",
          isMobileMenuOpen ? "pb-4" : "pb-0"
        )}>
          <TabsList 
            className="flex flex-nowrap overflow-x-auto sm:flex-wrap -mb-px gap-1 sm:gap-2 p-1 sm:p-0 bg-transparent"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="my-agents"
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors"
            >
              <User className="w-4 h-4" />
              <span>My Agents</span>
            </TabsTrigger>
            <TabsTrigger 
              value="public-agents"
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none hover:text-primary transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>Public Agents</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard
              title="Total Agents"
              value={dashboardMetrics.totalAgents}
              icon={Bot}
              description="Total number of your agents"
            />
            <DashboardCard
              title="Active Agents"
              value={dashboardMetrics.activeAgents}
              icon={Activity}
              description="Currently active agents"
              trend={{ value: 12, isPositive: true }}
            />
            <DashboardCard
              title="Total Runs"
              value={dashboardMetrics.totalRuns}
              icon={Zap}
              description="Total agent executions"
              trend={{ value: 8, isPositive: true }}
            />
            <DashboardCard
              title="Success Rate"
              value={`${dashboardMetrics.overallSuccess}%`}
              icon={Brain}
              description="Overall success rate"
              trend={{ value: 4, isPositive: true }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {userAgents.map((agent) => (
              <AgentMetricsCard 
                key={agent.agentId} 
                agent={agent} 
                metrics={agentMetrics[agent.agentId] || {
                  successRate: 0,
                  totalRuns: 0,
                  averageResponseTime: 0,
                  status: 'idle'
                }} 
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-agents" className="space-y-4">
          {isLoading ? (
            <LoadingState type="user" />
          ) : userAgents.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {userAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <EmptyState type="user" onCreateClick={() => window.location.href = '/agents/create'} />
          )}
        </TabsContent>

        <TabsContent value="public-agents" className="space-y-4">
          {isLoading ? (
            <LoadingState type="public" />
          ) : publicAgents.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {publicAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <EmptyState type="public" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AgentsPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!isSignedIn) {
    redirect('/sign-in');
  }

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      </div>
    }>
      <AgentsContent />
    </Suspense>
  );
}
