"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  Database, 
  MessageSquare, 
  Workflow, 
  Zap, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Crown,
  Calendar,
  ArrowUpRight,
  Settings
} from "lucide-react";
import Link from "next/link";

// Mock data - in a real app, this would come from your backend
const getCurrentUsage = () => ({
  documentProcessing: {
    used: 2.3, // GB
    limit: 5, // GB based on Growth tier
    unit: "GB"
  },
  aiMessages: {
    used: 847,
    limit: null, // Unlimited on Growth tier
    unit: "messages"
  },
  workflows: {
    used: 3,
    limit: 5,
    unit: "workflows"
  },
  integrations: {
    used: 7,
    limit: 10,
    unit: "integrations"
  },
  apiCalls: {
    used: 12450,
    limit: 50000,
    unit: "calls"
  },
  // New AI model usage tracking based on Gemini 2.0 Flash pricing
  aiTokenUsage: {
    textInput: {
      used: 2.8, // Million tokens
      cost: 2.8 * 0.10, // $0.10 per 1M tokens
      unit: "M tokens"
    },
    textOutput: {
      used: 1.2, // Million tokens
      cost: 1.2 * 0.40, // $0.40 per 1M tokens
      unit: "M tokens"
    },
    audioInput: {
      used: 0.3, // Million tokens
      cost: 0.3 * 0.70, // $0.70 per 1M tokens
      unit: "M tokens"
    },
    audioOutput: {
      used: 0.15, // Million tokens
      cost: 0.15 * 8.50, // $8.50 per 1M tokens (Live API)
      unit: "M tokens"
    },
    imageGeneration: {
      used: 45, // Number of images
      cost: 45 * 0.039, // $0.039 per image
      unit: "images"
    },
    contextCaching: {
      used: 5.2, // Million tokens
      cost: 5.2 * 0.025, // $0.025 per 1M tokens
      unit: "M tokens"
    }
  }
});

const getOrgUsage = () => ({
  totalUsers: 24,
  activeUsers: 18,
  totalDocumentProcessing: 45.2,
  totalMessages: 15680,
  totalWorkflows: 47,
  totalApiCalls: 234567,
  monthlySpend: 1176, // Base subscription costs
  // AI model costs across organization
  aiModelCosts: {
    textInput: 24 * 2.8 * 0.10, // $0.10 per 1M tokens
    textOutput: 24 * 1.2 * 0.40, // $0.40 per 1M tokens
    audioInput: 24 * 0.3 * 0.70, // $0.70 per 1M tokens
    audioOutput: 24 * 0.15 * 8.50, // $8.50 per 1M tokens
    imageGeneration: 24 * 45 * 0.039, // $0.039 per image
    contextCaching: 24 * 5.2 * 0.025, // $0.025 per 1M tokens
    total: function() {
      return this.textInput + this.textOutput + this.audioInput + 
             this.audioOutput + this.imageGeneration + this.contextCaching;
    }
  },
  usageByTier: {
    growth: 12,
    scale: 8,
    enterprise: 4
  }
});

const getUserTier = () => "Growth"; // This would be determined by actual user data

const formatBytes = (gb: number) => {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  return `${gb.toFixed(1)} GB`;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(amount);
};

export default function UsagePage() {
  const { user, isLoaded } = useUser();
  const [timeRange, setTimeRange] = useState("30d");
  const [isAdmin, setIsAdmin] = useState(false); // This would be determined by actual user role
  
  // Mock admin detection - in real app, check user role
  useEffect(() => {
    if (user?.emailAddresses?.[0]?.emailAddress?.includes("admin")) {
      setIsAdmin(true);
    }
  }, [user]);

  const currentUsage = getCurrentUsage();
  const orgUsage = getOrgUsage();
  const userTier = getUserTier();

  if (!isLoaded) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const UsageCard = ({ title, icon: Icon, used, limit, unit = "blue" }: {
    title: string;
    icon: any;
    used: number;
    limit: number | null;
    unit: string;
    color?: string;
  }) => {
    const percentage = limit ? Math.min((used / limit) * 100, 100) : 0;
    const isNearLimit = percentage > 80;
    const isOverLimit = percentage >= 100;
    
    return (
      <Card className={`${isOverLimit ? 'border-red-200 bg-red-50' : isNearLimit ? 'border-yellow-200 bg-yellow-50' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {unit === "GB" ? formatBytes(used) : formatNumber(used)}
          </div>
          {limit && (
            <>
              <p className="text-xs text-muted-foreground">
                of {unit === "GB" ? formatBytes(limit) : formatNumber(limit)} {unit}
              </p>
              <div className="mt-2">
                <Progress 
                  value={percentage} 
                  className={`h-2 ${isOverLimit ? '[&>*]:bg-red-500' : isNearLimit ? '[&>*]:bg-yellow-500' : ''}`} 
                />
              </div>
              {isNearLimit && (
                <div className="mt-2 flex items-center text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {isOverLimit ? 'Limit exceeded' : 'Approaching limit'}
                </div>
              )}
            </>
          )}
          {!limit && (
            <p className="text-xs text-muted-foreground">Unlimited</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const PlanCard = () => {
    const aiUsage = currentUsage.aiTokenUsage;
    const totalAICost = Object.values(aiUsage).reduce((sum, item) => sum + item.cost, 0);
    const subscriptionCost = userTier === "Growth" ? 19 : userTier === "Scale" ? 49 : 0;
    const totalMonthlyCost = subscriptionCost + totalAICost;
    
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle>Current Plan: {userTier}</CardTitle>
            </div>
            <Badge variant="secondary">Active</Badge>
          </div>
          <CardDescription>
            {userTier === "Growth" && "Perfect for individuals & small teams"}
            {userTier === "Scale" && "For growing businesses"}
            {userTier === "Enterprise" && "Custom enterprise solution"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Cost Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subscription ({userTier})</span>
                <span>{formatCurrency(subscriptionCost)}/month</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>AI Model Usage</span>
                <span>{formatCurrency(totalAICost)}/month</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Estimated Cost</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(totalMonthlyCost)}/month
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Next billing: Jan 15, 2025
                </p>
                <p className="text-xs text-muted-foreground">
                  AI costs are billed monthly based on usage
                </p>
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/pricing">
                    <Settings className="h-4 w-4 mr-1" />
                    Manage Plan
                  </Link>
                </Button>
                {userTier !== "Enterprise" && (
                  <Button size="sm" asChild>
                    <Link href="/pricing">
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                      Upgrade
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Organization Usage</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Organization Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgUsage.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {orgUsage.activeUsers} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription Costs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(orgUsage.monthlySpend)}</div>
            <p className="text-xs text-muted-foreground">
              Monthly subscription fees
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Model Costs</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(orgUsage.aiModelCosts.total())}
            </div>
            <p className="text-xs text-muted-foreground">
              This month (all users)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document Processing</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(orgUsage.totalDocumentProcessing)}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(orgUsage.totalMessages)}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Cost Breakdown for Organization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Model Cost Breakdown</CardTitle>
            <CardDescription>Organization-wide AI usage costs • This month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
                <span className="font-medium">Total AI Spending</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(orgUsage.aiModelCosts.total())}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Text Input ({formatNumber(24 * 2.8)}M tokens)</span>
                  <span className="font-medium">{formatCurrency(orgUsage.aiModelCosts.textInput)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Text Output ({formatNumber(24 * 1.2)}M tokens)</span>
                  <span className="font-medium">{formatCurrency(orgUsage.aiModelCosts.textOutput)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Audio Processing ({formatNumber(24 * 0.45)}M tokens)</span>
                  <span className="font-medium">{formatCurrency(orgUsage.aiModelCosts.audioInput + orgUsage.aiModelCosts.audioOutput)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Image Generation ({formatNumber(24 * 45)} images)</span>
                  <span className="font-medium">{formatCurrency(orgUsage.aiModelCosts.imageGeneration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Context Caching ({formatNumber(24 * 5.2)}M tokens)</span>
                  <span className="font-medium">{formatCurrency(orgUsage.aiModelCosts.contextCaching)}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Projected monthly total</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(orgUsage.monthlySpend + orgUsage.aiModelCosts.total())}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Users across different pricing tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Growth ($19/month)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">{orgUsage.usageByTier.growth} users</span>
                  <Badge variant="secondary">${orgUsage.usageByTier.growth * 19}/month</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Scale ($49/month)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">{orgUsage.usageByTier.scale} users</span>
                  <Badge variant="secondary">${orgUsage.usageByTier.scale * 49}/month</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span>Enterprise (Custom)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">{orgUsage.usageByTier.enterprise} users</span>
                  <Badge variant="secondary">Custom</Badge>
                </div>
              </div>
              
              <div className="pt-4 mt-4 border-t">
                <h4 className="font-medium mb-3">Cost Optimization Recommendations</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                    <span>Audio processing is your highest AI cost. Consider text alternatives where possible.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                    <span>Context caching is saving ~{formatCurrency(24 * 5.2 * (0.10 - 0.025))} vs. regular tokens.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2"></div>
                    <span>Consider upgrading power users to reduce per-token costs.</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const UserDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Usage</h1>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">This month</span>
        </div>
      </div>

      <PlanCard />

      {/* AI Cost Breakdown - Featured prominently */}
      <AICostBreakdown />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <UsageCard
          title="Document Processing"
          icon={Database}
          used={currentUsage.documentProcessing.used}
          limit={currentUsage.documentProcessing.limit}
          unit={currentUsage.documentProcessing.unit}
        />
        
        <UsageCard
          title="AI Messages"
          icon={MessageSquare}
          used={currentUsage.aiMessages.used}
          limit={currentUsage.aiMessages.limit}
          unit={currentUsage.aiMessages.unit}
        />
        
        <UsageCard
          title="Workflows"
          icon={Workflow}
          used={currentUsage.workflows.used}
          limit={currentUsage.workflows.limit}
          unit={currentUsage.workflows.unit}
        />
        
        <UsageCard
          title="Integrations"
          icon={Zap}
          used={currentUsage.integrations.used}
          limit={currentUsage.integrations.limit}
          unit={currentUsage.integrations.unit}
        />
        
        <UsageCard
          title="API Calls"
          icon={BarChart3}
          used={currentUsage.apiCalls.used}
          limit={currentUsage.apiCalls.limit}
          unit={currentUsage.apiCalls.unit}
        />
      </div>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Tips</CardTitle>
          <CardDescription>Optimize your Ubumuntu AI experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Optimize AI costs</p>
              <p className="text-sm text-muted-foreground">
                Use context caching for repeated conversations and optimize prompt lengths to reduce token usage.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Optimize document uploads</p>
              <p className="text-sm text-muted-foreground">
                Compress large files before uploading to maximize your document processing allowance.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Use workflow automations</p>
              <p className="text-sm text-muted-foreground">
                Set up automations to handle repetitive tasks and reduce manual AI interactions.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Monitor AI spending</p>
              <p className="text-sm text-muted-foreground">
                Audio processing costs more than text. Consider using text-based interactions when possible.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const CostCard = ({ title, icon: Icon, used, cost, unit, description }: {
    title: string;
    icon: any;
    used: number;
    cost: number;
    unit: string;
    description?: string;
  }) => {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(cost)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(used)} {unit} used
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 opacity-75">
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const AICostBreakdown = () => {
    const aiUsage = currentUsage.aiTokenUsage;
    const totalCost = Object.values(aiUsage).reduce((sum, item) => sum + item.cost, 0);
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI Model Usage Costs
          </CardTitle>
          <CardDescription>
            Based on Gemini 2.0 Flash pricing • This month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Total Cost Header */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total AI Costs</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Estimated monthly AI model usage
              </p>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CostCard
                title="Text Input"
                icon={MessageSquare}
                used={aiUsage.textInput.used}
                cost={aiUsage.textInput.cost}
                unit={aiUsage.textInput.unit}
                description="$0.10 per 1M tokens"
              />
              
              <CostCard
                title="Text Output"
                icon={MessageSquare}
                used={aiUsage.textOutput.used}
                cost={aiUsage.textOutput.cost}
                unit={aiUsage.textOutput.unit}
                description="$0.40 per 1M tokens"
              />
              
              <CostCard
                title="Audio Processing"
                icon={Zap}
                used={aiUsage.audioInput.used + aiUsage.audioOutput.used}
                cost={aiUsage.audioInput.cost + aiUsage.audioOutput.cost}
                unit="M tokens"
                description="Input: $0.70, Output: $8.50 per 1M"
              />
              
              <CostCard
                title="Image Generation"
                icon={Database}
                used={aiUsage.imageGeneration.used}
                cost={aiUsage.imageGeneration.cost}
                unit={aiUsage.imageGeneration.unit}
                description="$0.039 per image"
              />
            </div>

            {/* Context Caching */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-sm">Context Caching</span>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aiUsage.contextCaching.used)} {aiUsage.contextCaching.unit} • $0.025 per 1M tokens
                  </p>
                </div>
                <span className="font-bold">
                  {formatCurrency(aiUsage.contextCaching.cost)}
                </span>
              </div>
            </div>

            {/* Usage Tips */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 text-sm mb-2">💡 Cost Optimization Tips</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Use context caching for repeated conversations</li>
                <li>• Optimize prompts to reduce token usage</li>
                <li>• Consider batch processing for multiple requests</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6">
      {isAdmin ? (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Organization Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="billing">Billing & Plans</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <AdminDashboard />
          </TabsContent>
          
          <TabsContent value="users">
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">User Management</h3>
              <p className="text-muted-foreground">Detailed user management coming soon</p>
            </div>
          </TabsContent>
          
          <TabsContent value="billing">
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Billing Management</h3>
              <p className="text-muted-foreground">Detailed billing management coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <UserDashboard />
      )}
    </div>
  );
} 