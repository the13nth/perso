'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AgentMetadata } from "@/lib/pinecone";
import { useAuth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

function AgentCard({ agent }: { agent: AgentMetadata }) {
  return (
    <Card className="group relative flex flex-col hover:border-primary/50 hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
          <Bot className="h-5 w-5" />
          {agent.name}
          {agent.isPublic && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              Public
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className="font-normal">
              {agent.category}
            </Badge>
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
            <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
          </Button>
        </Link>
        <Link 
          href={`/agent-chat?agentId=${agent.agentId}&agentName=${encodeURIComponent(agent.name)}&agentDescription=${encodeURIComponent(agent.description)}`} 
          className="flex-1"
        >
          <Button variant="outline" className="w-full" size="sm">
            Chat
            <Bot className="w-4 h-4 ml-2 opacity-70" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function AgentsContent() {
  const [publicAgents, setPublicAgents] = useState<AgentMetadata[]>([]);
  const [userAgents, setUserAgents] = useState<AgentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgents() {
      try {
        setIsLoading(true);
        setError(null);
        
        const [publicRes, userRes] = await Promise.all([
          fetch('/api/agents/public'),
          fetch('/api/agents/user')
        ]);

        if (!publicRes.ok || !userRes.ok) {
          throw new Error('Failed to fetch agents');
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

        setPublicAgents(validPublicAgents);
        setUserAgents(validUserAgents);
      } catch (error) {
        console.error('Error loading agents:', error);
        setError('Failed to load agents');
        setPublicAgents([]);
        setUserAgents([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadAgents();
  }, []);

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center text-destructive space-y-2">
              <p className="text-lg font-medium">{error}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground mt-1">Create and manage your AI agents</p>
        </div>
        <Link href="/agents/create">
          <Button className="w-full sm:w-auto shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="my-agents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="my-agents">My Agents</TabsTrigger>
          <TabsTrigger value="public">Public Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="my-agents" className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
              <p>Loading your agents...</p>
            </div>
          ) : userAgents.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {userAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">You haven&apos;t created any agents yet</p>
                  <Link href="/agents/create">
                    <Button variant="outline" className="mt-2">Create your first agent</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="public" className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
              <p>Loading public agents...</p>
            </div>
          ) : publicAgents.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {publicAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No public agents available</p>
                </div>
              </CardContent>
            </Card>
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
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    redirect('/sign-in');
  }

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <AgentsContent />
    </Suspense>
  );
}
