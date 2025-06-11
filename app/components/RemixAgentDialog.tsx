import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { remixAgents } from "@/lib/agents/remix/supervisor";
import type { Agent } from "@/lib/agents/remix/types";

interface RemixAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  publicAgents: Agent[];
  userAgents: Agent[];
}

export function RemixAgentDialog({
  isOpen,
  onClose,
  publicAgents,
  userAgents
}: RemixAgentDialogProps) {
  const router = useRouter();
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleRemix = async () => {
    if (selectedAgents.length < 2) {
      toast.error("Please select at least 2 agents to remix");
      return;
    }

    setIsLoading(true);

    try {
      // Get the full agent objects for selected agents
      const agents = [
        ...publicAgents,
        ...userAgents
      ].filter(agent => selectedAgents.includes(agent.agentId));

      // Use our multi-agent system to create the super agent
      const superAgent = await remixAgents(agents);

      if (!superAgent) {
        throw new Error("Failed to create super agent configuration");
      }

      // Create the super agent via API
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...superAgent,
          parentAgents: selectedAgents
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create super agent");
      }

      const data = await response.json();
      toast.success("Super agent created successfully");
      router.push(`/agents/${data.agentId}`);
      onClose();
    } catch (_error) {
      console.error("Error creating super agent:", _error);
      toast.error(_error instanceof Error ? _error.message : "Failed to create super agent");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Remix Agents</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Tabs defaultValue="public">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="public">
                Public Agents ({publicAgents.length})
              </TabsTrigger>
              <TabsTrigger value="private">
                My Agents ({userAgents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="public" className="mt-4">
              <div className="space-y-4">
                {publicAgents.map((agent) => (
                  <div key={agent.agentId} className="flex items-start space-x-3">
                    <Checkbox
                      id={`public-${agent.agentId}`}
                      checked={selectedAgents.includes(agent.agentId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAgents([...selectedAgents, agent.agentId]);
                        } else {
                          setSelectedAgents(selectedAgents.filter(id => id !== agent.agentId));
                        }
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor={`public-${agent.agentId}`}>
                        {agent.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="private" className="mt-4">
              <div className="space-y-4">
                {userAgents.map((agent) => (
                  <div key={agent.agentId} className="flex items-start space-x-3">
                    <Checkbox
                      id={`private-${agent.agentId}`}
                      checked={selectedAgents.includes(agent.agentId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAgents([...selectedAgents, agent.agentId]);
                        } else {
                          setSelectedAgents(selectedAgents.filter(id => id !== agent.agentId));
                        }
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor={`private-${agent.agentId}`}>
                        {agent.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRemix} disabled={selectedAgents.length < 2 || isLoading}>
            {isLoading ? "Creating..." : "Create Super Agent"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 