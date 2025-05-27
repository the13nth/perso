'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AgentInterface } from "@/components/AgentInterface";
import { AgentMetadata } from "@/lib/pinecone";
import { useAuth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

function AgentCard({ agent }: { agent: AgentMetadata }) {
  return (
    <Card className="hover:border-primary transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          {agent.name}
        </CardTitle>
        <CardDescription>{agent.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Category: {agent.category}
          </div>
          <Link href={`/agents/${agent.agentId}`}>
            <Button className="w-full">
              Chat with Agent
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentsContent() {
  const [publicAgents, setPublicAgents] = useState<AgentMetadata[]>([]);
  const [userAgents, setUserAgents] = useState<AgentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAgents() {
      try {
        const [publicRes, userRes] = await Promise.all([
          fetch('/api/agents/public'),
          fetch('/api/agents/user')
        ]);

        const publicData = await publicRes.json();
        const userData = await userRes.json();

        setPublicAgents(publicData.agents);
        setUserAgents(userData.agents);
      } catch (error) {
        console.error('Error loading agents:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAgents();
  }, []);

  return (
    <div className="container py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Agents</h1>
        <Link href="/agents/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="my-agents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-agents">My Agents</TabsTrigger>
          <TabsTrigger value="public">Public Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="my-agents" className="space-y-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading your agents...
            </div>
          ) : userAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              You haven't created any agents yet.
              <br />
              <Link href="/agents/create">
                <Button variant="link">Create your first agent</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="public" className="space-y-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading public agents...
            </div>
          ) : publicAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              No public agents available yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AgentsPage() {
  const { isLoaded, isSignedIn } = useAuth();

  // Show loading state while auth is being checked
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
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

  return (
    <div className="w-full min-h-screen bg-background">
      <Suspense 
        fallback={
          <div className="flex justify-center items-center min-h-screen px-4">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <div className="text-base sm:text-lg text-foreground">
                Loading agents...
              </div>
            </div>
          </div>
        }
      >
        <AgentsContent />
      </Suspense>
    </div>
  );
}
