import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle } from "lucide-react";
import { AgentRunMetrics } from "@/lib/services/agent-runner";
import { AgentMetadata } from "@/lib/pinecone";

interface AgentResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentMetadata;
  metrics: AgentRunMetrics;
}

export function AgentResultsDialog({ open, onOpenChange, agent, metrics }: AgentResultsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {agent.name} Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={metrics.status === 'running' ? 'default' : 
                            metrics.status === 'completed' ? 'outline' : 'secondary'}
                  >
                    {metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{metrics.successRate}% Success Rate</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Runs</p>
                  <p className="text-2xl font-bold">{metrics.totalRuns}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Response Time</p>
                  <p className="text-2xl font-bold">{metrics.averageResponseTime}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent Details */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-2">Agent Details</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{agent.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="text-sm">{agent.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Use Cases</p>
                  <p className="text-sm">{agent.useCases}</p>
                </div>
                {agent.triggers && agent.triggers.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Triggers</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {agent.triggers.map((trigger, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {trigger}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 