import { ContentMetadata } from '../app/lib/content/types';

// Core Swarm System Types and Interfaces

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | 'broadcast'; // 'broadcast' for swarm-wide messages
  messageType: 'task_request' | 'data_share' | 'result_handoff' | 'capability_query' | 'status_update' | 'coordination';
  payload: any;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sessionId: string;
  requiresResponse?: boolean;
  responseToMessageId?: string;
}

export interface SwarmSession {
  sessionId: string;
  userId: string;
  activeAgents: string[];
  coordinatorAgent: string;
  task: ComplexTask;
  status: 'forming' | 'active' | 'completing' | 'completed' | 'dissolved' | 'error';
  messageLog: AgentMessage[];
  createdAt: number;
  lastActivity: number;
  completedAt?: number;
  results: SwarmResult[];
  performanceMetrics?: SwarmPerformanceMetrics;
  metadata: ContentMetadata;
}

export interface ComplexTask {
  id: string;
  title?: string;
  description: string;
  category?: string;
  type: string;
  requirements: TaskRequirement[];
  decomposition?: TaskDecomposition;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: number;
  constraints?: string[];
  expectedOutputFormat?: string;
  context?: Record<string, any>;
}

export interface TaskRequirement {
  type: 'capability' | 'domain_knowledge' | 'data_access' | 'processing_power';
  value: string;
  importance: 'required' | 'preferred' | 'optional';
  alternatives?: string[];
}

export interface TaskConstraint {
  type: 'time' | 'resources' | 'quality' | 'format';
  value: any;
  description: string;
}

export interface TaskDecomposition {
  subTasks: SubTask[];
  dependencies: TaskDependency[];
  estimatedComplexity: number;
  requiredCapabilities: string[];
}

export interface TaskDependency {
  fromTaskId: string;
  toTaskId: string;
  type: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export interface SubTask {
  id: string;
  parentTaskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgentId?: string;
  startTime?: number;
  endTime?: number;
  result?: any;
  estimatedDuration?: number;
  actualDuration?: number;
  completedAt?: number;
  startedAt?: number;
}

export interface SwarmResult {
  // Core Metadata
  contentType: 'swarm_result';
  contentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: 'active' | 'archived' | 'deleted';

  // Chunking Information
  chunkIndex: number;
  totalChunks: number;
  isFirstChunk: boolean;

  // Access Control
  access: 'public' | 'personal' | 'shared';
  sharedWith?: string[];

  // Classification & Organization
  primaryCategory: string;
  secondaryCategories: string[];
  tags: string[];

  // Content Fields
  title: string;
  text: string;
  summary?: string;

  // Search Optimization
  searchableText: string;
  keywords: string[];
  language?: string;

  // Relationships
  relatedIds: string[];
  references: string[];

  // Swarm-specific metadata
  swarm: {
    agentId: string;
    taskId?: string;
    confidence: number;
    resultType: 'intermediate' | 'final' | 'insight' | 'recommendation';
    performanceMetrics?: {
      processingTime: number;
      resourceUsage: number;
      qualityScore: number;
    };
    validations?: {
      method: string;
      score: number;
      timestamp: number;
    }[];
  };
}

export interface SwarmPerformanceMetrics {
  totalDuration: number;
  agentUtilization: Record<string, number>;
  communicationEfficiency: number;
  taskCompletionRate: number;
  userSatisfactionScore?: number;
  resourceUsage: ResourceUsage;
  collaborationScore: number;
}

export interface ResourceUsage {
  computeTime: number;
  memoryUsage: number;
  apiCalls: number;
  tokenUsage: number;
  cost: number;
}

// Enhanced Agent Capabilities

export interface AgentCapability {
  name: string;
  type: 'analysis' | 'generation' | 'processing' | 'integration' | 'coordination' | 'specialized';
  proficiencyLevel: number; // 0-100
  domains: string[];
  prerequisites: string[];
  description: string;
  examples: string[];
  lastUpdated: number;
  usageCount: number;
  successRate: number;
}

export interface AgentSpecialization {
  domain: string;
  level: 'novice' | 'intermediate' | 'expert' | 'master';
  certifications?: string[];
  experience: number; // Number of successful tasks
  lastUsed: number;
}

export interface AdaptationEvent {
  timestamp: number;
  trigger: 'user_feedback' | 'performance_decline' | 'new_pattern' | 'collaboration_learning';
  changes: CapabilityChange[];
  impact: 'minor' | 'moderate' | 'significant';
  success: boolean;
}

export interface CapabilityChange {
  capability: string;
  changeType: 'added' | 'removed' | 'improved' | 'deprecated';
  oldValue?: any;
  newValue?: any;
  reason: string;
}

// Extended Agent Metadata for Swarm Capabilities

export interface SwarmCapableAgent {
  // Existing agent properties
  agentId: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  userId: string;
  ownerId: string;
  useCases: string;
  triggers: string[];
  selectedContextIds: string[];
  type: string;
  
  // New swarm capabilities
  capabilities: AgentCapability[];
  specializations: AgentSpecialization[];
  
  // Collaboration features
  collaborationScore: number;
  trustScore: number;
  communicationProtocols: string[];
  preferredRoles: SwarmRole[];
  
  // Performance tracking
  taskCompletionRate: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
  totalTasksCompleted: number;
  
  // Learning features
  adaptationHistory: AdaptationEvent[];
  learningRate: number;
  adaptationEnabled: boolean;
  
  // Swarm-specific metadata
  maxConcurrentSwarms: number;
  currentSwarmLoad: number;
  lastSwarmActivity: number;
  swarmParticipationCount: number;
  
  // Version and evolution
  version: string;
  parentAgentId?: string;
  evolutionGeneration: number;
}

export interface SwarmRole {
  name: 'coordinator' | 'specialist' | 'analyzer' | 'integrator' | 'validator' | 'communicator';
  proficiency: number;
  experience: number;
  preferences: string[];
}

// Swarm Health and Monitoring

export interface SwarmHealthReport {
  sessionId: string;
  timestamp: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  agentHealth: AgentHealthStatus[];
  communicationHealth: CommunicationHealthMetrics;
  taskProgress: TaskProgressMetrics;
  issues: SwarmIssue[];
  recommendations: string[];
}

export interface AgentHealthStatus {
  agentId: string;
  status: 'active' | 'idle' | 'overloaded' | 'unresponsive' | 'error';
  responseTime: number;
  taskLoad: number;
  errorRate: number;
  lastActivity: number;
}

export interface CommunicationHealthMetrics {
  messageVolume: number;
  averageResponseTime: number;
  failedMessageRate: number;
  coordinationEfficiency: number;
  bottlenecks: string[];
}

export interface TaskProgressMetrics {
  completedSubTasks: number;
  totalSubTasks: number;
  estimatedTimeRemaining: number;
  blockedTasks: string[];
  criticalPathProgress: number;
}

export interface SwarmIssue {
  type: 'communication' | 'performance' | 'coordination' | 'resource' | 'logic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedAgents: string[];
  suggestedActions: string[];
  timestamp: number;
}

// Agent Communication Interfaces

export interface CommunicationChannel {
  channelId: string;
  sessionId: string;
  participants: string[];
  type: 'direct' | 'broadcast' | 'group';
  topic?: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
}

export interface MessageResponse {
  success: boolean;
  messageId: string;
  deliveredTo: string[];
  failedDeliveries: string[];
  timestamp: number;
}

// Search and Discovery Types

export interface AgentSearchQuery {
  query?: string;
  capabilities?: string[];
  domains?: string[];
  minTrustScore?: number;
  minCollaborationScore?: number;
  availabilityRequired?: boolean;
  excludeAgents?: string[];
  maxResults?: number;
  sortBy?: 'relevance' | 'trust_score' | 'performance' | 'recent_activity';
}

export interface AgentRecommendation {
  agent: SwarmCapableAgent;
  relevanceScore: number;
  reasonsForRecommendation: string[];
  compatibilityScore: number;
  estimatedContribution: number;
}

// Marketplace Types

export interface AgentRating {
  userId: string;
  agentId: string;
  rating: number; // 1-5
  category: 'performance' | 'collaboration' | 'reliability' | 'innovation';
  comment?: string;
  taskContext?: string;
  timestamp: number;
}

export interface AgentReview {
  reviewId: string;
  userId: string;
  agentId: string;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  recommendedFor: string[];
  verified: boolean;
  helpfulVotes: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  agentId: string;
  timeframe: string;
  metrics: {
    taskCompletionRate: number;
    averageResponseTime: number;
    userSatisfactionScore: number;
    collaborationEffectiveness: number;
    errorRate: number;
    adaptationRate: number;
    usageFrequency: number;
  };
  trends: {
    improving: string[];
    declining: string[];
    stable: string[];
  };
  benchmarks: {
    categoryAverage: number;
    topPerformer: number;
    userExpectation: number;
  };
}

// Agent Evolution Types

export interface ImprovementPlan {
  agentId: string;
  currentCapabilities: AgentCapability[];
  recommendedImprovements: CapabilityImprovement[];
  learningPath: LearningStep[];
  estimatedTimeline: number;
  requiredResources: string[];
  successMetrics: string[];
}

export interface CapabilityImprovement {
  capability: string;
  currentLevel: number;
  targetLevel: number;
  priority: 'low' | 'medium' | 'high';
  reason: string;
  requiredData: string[];
  estimatedEffort: number;
}

export interface LearningStep {
  stepId: string;
  description: string;
  type: 'data_analysis' | 'pattern_recognition' | 'feedback_integration' | 'capability_expansion';
  dependencies: string[];
  estimatedDuration: number;
  successCriteria: string[];
}

// Swarm Prediction Types

export interface SwarmPrediction {
  taskId: string;
  recommendedAgents: AgentRecommendation[];
  estimatedDuration: number;
  estimatedCost: number;
  successProbability: number;
  riskFactors: string[];
  alternativeCompositions: AlternativeSwarmComposition[];
  reasoning: string;
}

export interface AlternativeSwarmComposition {
  agents: string[];
  estimatedDuration: number;
  estimatedCost: number;
  pros: string[];
  cons: string[];
  useCase: string;
}

export default {}; 