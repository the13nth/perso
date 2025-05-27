'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Tag, Calendar, User, Globe, Lock } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

interface AgentDetails {
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string[];
  isPublic: boolean;
  createdAt: number;
  ownerId: string;
}

export default function AgentDetailsPage() {
  const { agentId } = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAgentDetails() {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch agent details');
        }
        const data = await response.json();
        setAgent(data);
      } catch (error) {
        console.error('Error fetching agent details:', error);
        toast.error('Failed to load agent details');
      } finally {
        setIsLoading(false);
      }
    }

    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  if (!isLoaded || isLoading) {
    return (
      <div className="container py-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-base sm:text-lg text-foreground">
              Loading...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container py-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-base sm:text-lg text-foreground">
              Agent not found
            </div>
            <Button
              variant="link"
              onClick={() => router.push('/agents')}
              className="mt-4"
            >
              Back to Agents
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = isSignedIn && user?.id === agent.ownerId;

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
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                {agent.name}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="w-4 h-4" />
                {agent.category}
                {agent.isPublic ? (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    Public
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4" />
                    Private
                  </div>
                )}
              </div>
            </div>
            {isOwner && (
              <Button variant="outline" onClick={() => router.push(`/agents/${agentId}/edit`)}>
                Edit Agent
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">Description</h3>
            <p className="text-muted-foreground">{agent.description}</p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Use Cases</h3>
            <p className="text-muted-foreground">{agent.useCases}</p>
          </div>

          {agent.triggers.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Triggers</h3>
              <div className="flex flex-wrap gap-2">
                {agent.triggers.map((trigger, index) => (
                  <div
                    key={index}
                    className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                  >
                    {trigger}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Created {new Date(agent.createdAt).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {isOwner ? 'You are the owner' : 'Created by another user'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 