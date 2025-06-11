"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BarChart3, Lightbulb, ArrowRight, BookOpen, Building2, Heart, Users, Sparkles, Database, CheckCircle2, AlertCircle, Loader2, RefreshCw, FileText, Bot, Brain, Filter } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

// Sample categories with icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Business": <Building2 className="w-5 h-5" />,
  "Education": <BookOpen className="w-5 h-5" />,
  "Health": <Heart className="w-5 h-5" />,
  "Technology": <Database className="w-5 h-5" />,
  "Community": <Users className="w-5 h-5" />,
  "Uncategorized": <BarChart3 className="w-5 h-5" />
};

// Get an icon for a category (with fallback)
function getCategoryIcon(category: string) {
  return CATEGORY_ICONS[category] || <FileText className="w-5 h-5" />;
}

interface CategorySummary {
  name: string;
  count: number;
  topWords: string[];
  description: string;
}

interface InsightResponse {
  summary: string;
  trends: string[];
  keyTopics: string[];
  recommendations: string[];
  connections: string[];
  documentCount?: number;
  sampledCount?: number;
  insightType?: "summary" | "full";
  useAllDocuments?: boolean;
}

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

// New interface for Agent
interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export default function InsightsPage() {
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategorySummary | null>(null);
  const [insightData, setInsightData] = useState<InsightResponse | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null);
  
  // New state for agent selection
  const [agentSelectionOpen, setAgentSelectionOpen] = useState(false);
  const [availableAgents] = useState<Agent[]>([
    {
      id: "research-agent",
      name: "Research Assistant",
      description: "Finds and analyzes information from multiple sources",
      icon: <BookOpen className="h-4 w-4" />
    },
    {
      id: "data-agent",
      name: "Data Analyst",
      description: "Identifies patterns and trends in numerical data",
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      id: "knowledge-agent",
      name: "Knowledge Base",
      description: "Accesses and synthesizes information from your knowledge base",
      icon: <Database className="h-4 w-4" />
    },
    {
      id: "writing-agent",
      name: "Writing Assistant",
      description: "Helps craft clear and compelling narratives from data",
      icon: <FileText className="h-4 w-4" />
    },
    {
      id: "insight-agent",
      name: "Insights Generator",
      description: "Specializes in finding non-obvious connections between concepts",
      icon: <Brain className="h-4 w-4" />
    }
  ]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [insightType, setInsightType] = useState<"summary" | "full">("full");

  // Fetch real categories from Pinecone embeddings
  useEffect(() => {
    async function fetchEmbeddings() {
      setLoading(true);
      setFetchError(null);
      
      try {
        const response = await fetch('/api/embeddings?limit=10000');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch embeddings: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const embeddings: Embedding[] = data.embeddings || [];
        
        // Process embeddings to generate category summaries
        const categoryMap = new Map<string, {
          count: number;
          texts: string[];
          words: Record<string, number>;
        }>();
        
        // Populate category map with embeddings data
        embeddings.forEach(embedding => {
          const text = embedding.metadata.text || '';
          const categories = embedding.metadata.categories || ['Uncategorized'];
          
          // Count word frequencies for each category
          const words = text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3)
            .reduce((acc: Record<string, number>, word) => {
              acc[word] = (acc[word] || 0) + 1;
              return acc;
            }, {});
            
          categories.forEach(category => {
            if (!categoryMap.has(category)) {
              categoryMap.set(category, {
                count: 0,
                texts: [],
                words: {}
              });
            }
            
            const catData = categoryMap.get(category)!;
            catData.count++;
            
            if (text) {
              catData.texts.push(text);
            }
            
            // Merge word frequencies
            Object.entries(words).forEach(([word, count]) => {
              catData.words[word] = (catData.words[word] || 0) + count;
            });
          });
        });
        
        // Generate summaries from the category data
        const summaries: CategorySummary[] = [];
        
        categoryMap.forEach((data, category) => {
          // Get top words by frequency
          const topWords = Object.entries(data.words)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
            
          // Generate a description based on the data
          let description = `Contains ${data.count} documents`;
          if (topWords.length > 0) {
            description += ` with frequent topics including ${topWords.slice(0, 3).join(', ')}`;
          }
          description += '.';
          
          summaries.push({
            name: category,
            count: data.count,
            topWords,
            description
          });
        });
        
        // Sort by document count (highest first)
        setCategorySummaries(summaries.sort((a, b) => b.count - a.count));
      } catch (_error) {
        console.error('Error fetching embeddings:', _error);
        setFetchError(_error instanceof Error ? _error.message : 'Failed to load categories');
        
        // Set some mock data as fallback
        setCategorySummaries([
          {
            name: "Uncategorized",
            count: 42,
            topWords: ["various", "mixed", "general", "diverse", "miscellaneous"],
            description: "Uncategorized documents contain diverse content that doesn't fit neatly into other categories, with mixed terminology and topics."
          }
        ]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchEmbeddings();
  }, []);

  // Function to generate insights for a category
  async function generateInsight(category: CategorySummary, insightType: "summary" | "full" = "full") {
    setSelectedCategory(category);
    setSelectedAgents(["insight-agent"]); // Default selection
    setAgentSelectionOpen(true);
    setInsightType(insightType);
  }
  
  // New function to proceed with insight generation after agent selection
  async function proceedWithInsightGeneration() {
    if (!selectedCategory) return;
    
    setAgentSelectionOpen(false);
    setInsightLoading(true);
    setInsightError(null);
    setInsightData(null);
    setSavedInsightId(null);
    setDialogOpen(true);
    
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: selectedCategory.name,
          topWords: selectedCategory.topWords,
          agents: selectedAgents,
          insightType: insightType,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insights');
      }
      
      const data = await response.json();
      setInsightData(data);
    } catch (_error) {
      console.error('Error generating insights:', _error);
      setInsightError(_error instanceof Error ? _error.message : 'An unknown error occurred');
    } finally {
      setInsightLoading(false);
    }
  }

  // Function to save an insight to Pinecone
  async function saveInsight() {
    if (!insightData || !selectedCategory) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch('/api/insights/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: selectedCategory.name,
          insightType: insightType,
          ...insightData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save insight');
      }
      
      const data = await response.json();
      setSavedInsightId(data.insightId);
      toast.success("Insight saved successfully!", {
        description: `The ${insightType} insight has been saved under "${data.category}" and can be retrieved in future searches.`,
        duration: 5000,
      });
    } catch (_error) {
        console.error('Error saving insight:', _error);
      toast.error("Failed to save insight", {
        description: _error instanceof Error ? _error.message : "An unknown error occurred",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col overflow-hidden">
      <div className="flex-none p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Embedding Insights</h1>
            <p className="text-muted-foreground mt-1">
              Explore and generate insights from your document embeddings by category
            </p>
          </div>
          {!loading && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.reload()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Categories
            </Button>
          )}
        </div>
      </div>

      <div className="flex-grow p-4 md:p-6 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="opacity-70 animate-pulse">
                <CardHeader>
                  <CardTitle className="h-7 bg-muted rounded"></CardTitle>
                  <CardDescription className="h-4 bg-muted rounded mt-2 w-3/4"></CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-5/6 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-4/6"></div>
                </CardContent>
                <CardFooter>
                  <div className="h-9 bg-muted rounded w-full"></div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : fetchError ? (
          <div className="rounded-lg border p-8 text-center max-w-2xl mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to Load Categories</h3>
            <p className="text-muted-foreground mb-4">{fetchError}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : categorySummaries.length === 0 ? (
          <div className="rounded-lg border p-8 text-center max-w-2xl mx-auto">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Categories Found</h3>
            <p className="text-muted-foreground mb-4">
              Upload documents with categories to generate insights.
            </p>
            <Button asChild>
              <a href="/retrieval">Upload Documents</a>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categorySummaries.map((category) => (
              <Card key={category.name} className="overflow-hidden transition-all hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {getCategoryIcon(category.name)}
                    </div>
                    <CardTitle>{category.name}</CardTitle>
                  </div>
                  <CardDescription>
                    {category.count} documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                  {category.topWords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      <span className="text-xs font-medium">Top words: </span>
                      {category.topWords.map((word) => (
                        <span 
                          key={word} 
                          className="text-xs px-2 py-0.5 bg-secondary rounded-full"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {category.name === "physical" ? (
                    <Button 
                      onClick={() => generateInsight(category)}
                      className="w-full gap-2 group"
                      disabled={category.count === 0}
                    >
                      <Lightbulb className="w-4 h-4" />
                      Generate Full Insight
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  ) : (
                    <div className="w-full space-y-2">
                      <Button 
                        onClick={() => generateInsight(category, "summary")}
                        className="w-full gap-2 group"
                        disabled={category.count === 0}
                        variant="outline"
                      >
                        <Lightbulb className="w-4 h-4" />
                        Quick Insight
                        <span className="text-xs text-muted-foreground ml-1">(few docs)</span>
                      </Button>
                      <Button 
                        onClick={() => generateInsight(category, "full")}
                        className="w-full gap-2 group"
                        disabled={category.count === 0}
                      >
                        <Lightbulb className="w-4 h-4" />
                        Full Insight
                        <span className="text-xs text-muted-foreground ml-1">(all docs)</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Agent Selection Dialog */}
      <Dialog open={agentSelectionOpen} onOpenChange={setAgentSelectionOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Select Agents for Insight Generation
            </DialogTitle>
            <DialogDescription>
              Choose which agents to use when analyzing {selectedCategory?.name} documents.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              {availableAgents.map((agent) => (
                <div key={agent.id} className="flex items-start space-x-3 border-b pb-3">
                  <Checkbox 
                    id={agent.id}
                    checked={selectedAgents.includes(agent.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedAgents([...selectedAgents, agent.id]);
                      } else {
                        setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                      }
                    }}
                  />
                  <div className="grid gap-1.5">
                    <label
                      htmlFor={agent.id}
                      className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                    >
                      <div className="p-1 rounded-md bg-primary/10 text-primary">
                        {agent.icon}
                      </div>
                      {agent.name}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentSelectionOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={proceedWithInsightGeneration}
              disabled={selectedAgents.length === 0}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {`Generate with ${selectedAgents.length} Agent${selectedAgents.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insight Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-none">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {selectedCategory?.name} Insights
            </DialogTitle>
            <DialogDescription>
              {selectedCategory?.name === "physical" 
                ? `AI-powered physical activity insights based on ALL documents (${selectedCategory?.count} physical activity documents plus all other categories) to find connections between physical activities and other life aspects.`
                : insightType === "full"
                  ? `Comprehensive AI insights for ${selectedCategory?.name} based on ALL documents (${selectedCategory?.count} ${selectedCategory?.name} documents plus all other categories) to find cross-category connections and patterns.`
                  : `Focused AI insights based on ${selectedCategory?.count} documents specifically in the ${selectedCategory?.name} category.`
              }
            </DialogDescription>
            {insightData?.documentCount && (
              <div className="mt-1 text-xs text-muted-foreground">
                Analysis based on {insightData.sampledCount} documents {insightData.sampledCount !== insightData.documentCount ? 
                  `(sampled from ${insightData.documentCount} total)` : ''} from Pinecone
                {(selectedCategory?.name === "physical" || insightData.useAllDocuments) && (
                  <span className="block text-orange-600 dark:text-orange-400 font-medium">
                    {selectedCategory?.name === "physical" 
                      ? "Including documents from all categories to find cross-category insights for physical activities"
                      : "Including documents from all categories for comprehensive cross-category insights"
                    }
                  </span>
                )}
              </div>
            )}
          </DialogHeader>
          
          <div className="flex-grow overflow-y-auto py-4">
            {insightLoading ? (
              <div className="py-8 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">
                  {selectedCategory?.name === "physical" 
                    ? `Generating physical activity insights using ALL documents to find cross-category patterns...`
                    : insightType === "full"
                      ? `Generating comprehensive ${selectedCategory?.name} insights using ALL documents to find cross-category patterns...`
                      : `Generating focused ${selectedCategory?.name} insights from category-specific documents...`
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedCategory?.name === "physical" 
                    ? "Analyzing documents from all categories to understand how physical activities connect to work, study, routines, and overall well-being"
                    : insightType === "full"
                      ? `Analyzing documents from all categories to understand how ${selectedCategory?.name} connects to other life aspects and overall patterns`
                      : "Retrieving and analyzing category-specific documents with Google's Gemini model"
                  }
                </p>
              </div>
            ) : insightError ? (
              <div className="py-6 flex flex-col items-center">
                <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                <h3 className="text-lg font-medium mb-1">Failed to generate insights</h3>
                <p className="text-sm text-muted-foreground mb-4">{insightError}</p>
                <Button 
                  onClick={() => selectedCategory && generateInsight(selectedCategory)}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            ) : insightData ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Summary</h3>
                  <p className="text-sm">{insightData.summary}</p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Key Trends</h3>
                  <ul className="space-y-1">
                    {insightData.trends.map((trend, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{trend}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Key Topics</h3>
                    <ul className="space-y-1">
                      {insightData.keyTopics.map((topic, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs flex-shrink-0">
                            {index + 1}
                          </span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Recommendations</h3>
                    <ul className="space-y-1">
                      {insightData.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs flex-shrink-0">
                            {index + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Interesting Connections</h3>
                  <div className="bg-muted/40 p-3 rounded-md">
                    <ul className="space-y-2">
                      {insightData.connections.map((connection, index) => (
                        <li key={index} className="text-sm pl-3 border-l-2 border-primary/60">
                          {connection}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm">
                    No insights generated yet. Click &quot;Generate Insight&quot; to analyze documents in this category.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-none border-t pt-4">
            {insightData && (
              <>
                <Button 
                  variant="outline" 
                  onClick={saveInsight}
                  disabled={isSaving || !!savedInsightId}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : savedInsightId ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Saved
                    </>
                  ) : (
                    "Save Insight"
                  )}
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Close</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
} 