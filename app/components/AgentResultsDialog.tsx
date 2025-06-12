import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle, Brain, Clock, Target } from "lucide-react";
import { AgentRunMetrics } from "@/lib/services/agent-runner";
import { AgentMetadata } from "@/lib/pinecone";

interface AgentResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentMetadata;
  metrics: AgentRunMetrics;
}

export function AgentResultsDialog({ open, onOpenChange, agent, metrics }: AgentResultsDialogProps) {
  // Early return if metrics is not available
  if (!metrics) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Results...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  console.log('[DEBUG] AgentResultsDialog - Initial metrics:', metrics);

  // Parse the response if it's a JSON string
  const parseResponse = (response: string) => {
    try {
      return JSON.parse(response);
    } catch (e) {
      return response;
    }
  };

  const results = metrics.results?.map(result => {
    console.log('[DEBUG] Processing result:', result);
    const processed = {
      ...result,
      output: result.output ? {
        ...result.output,
        insights: result.output.insights?.map(insight => {
          console.log('[DEBUG] Processing insight:', insight);
          return {
            ...insight,
            ...(typeof insight === 'string' ? parseResponse(insight) : {})
          };
        })
      } : null
    };
    console.log('[DEBUG] Processed result:', processed);
    return processed;
  });

  console.log('[DEBUG] AgentResultsDialog - Processed results:', results);

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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="font-medium flex items-center gap-1">
                    {metrics.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : metrics.status === 'error' ? (
                      <span className="text-red-500">Error</span>
                    ) : (
                      <span>Running</span>
                    )}
                    {metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="font-medium">{Math.round(metrics.successRate * 100)}%</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Total Runs</span>
                  <span className="font-medium">{metrics.totalRuns}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Avg Response Time</span>
                  <span className="font-medium">{Math.round(metrics.averageResponseTime)}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights Cards */}
          {results && results.length > 0 && results.map((result, index) => (
            result.output?.insights && result.output.insights.length > 0 && (
              <Card key={index}>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Generated Insights
                  </h3>
                  <div className="space-y-4">
                    {result.output.insights.map((insight, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{insight.category}</Badge>
                          <Badge variant="secondary">Confidence: {insight.confidence}%</Badge>
                        </div>
                        <p className="font-medium mb-2">{insight.insight}</p>
                        <p className="text-sm text-muted-foreground">{insight.evidence}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Response Time: {result.responseTime}ms
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Context Relevance: {result.metrics.contextRelevance}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          ))}

          {/* Error Display */}
          {metrics.error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-red-800 mb-2">Error</h3>
                <p className="text-sm text-red-600">{metrics.error}</p>
              </CardContent>
            </Card>
          )}

          {/* Agent Details */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-2">Agent Details</h3>
              <div className="space-y-2">
                {agent.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{agent.description}</p>
                </div>
                )}
                {agent.category && (
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="text-sm">{agent.category}</p>
                </div>
                )}
                {agent.useCases && (
                <div>
                  <p className="text-sm text-muted-foreground">Use Cases</p>
                  <p className="text-sm">{agent.useCases}</p>
                </div>
                )}
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