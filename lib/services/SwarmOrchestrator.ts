import { v4 as uuidv4 } from 'uuid';
import { 
  SwarmSession, 
  ComplexTask, 
  SwarmCapableAgent, 
  AgentMessage, 
  SwarmHealthReport, 
  SwarmResult,
  SubTask,
  SwarmPerformanceMetrics
} from '@/types/swarm';
import { TaskDecomposer } from './TaskDecomposer';
import { AgentDiscoveryService } from './AgentDiscoveryService';
import { CommunicationManager } from './CommunicationManager';
import { SwarmMonitor } from './SwarmMonitor';
import { firestoreSwarmStorage } from './FirestoreSwarmStorage';
import { taskExecutionEngine } from './TaskExecutionEngine';

export class SwarmOrchestrator {
  private taskDecomposer: TaskDecomposer;
  private agentDiscovery: AgentDiscoveryService;
  private communicationManager: CommunicationManager;
  private swarmMonitor: SwarmMonitor;
  private activeSessions: Map<string, SwarmSession> = new Map();

  constructor() {
    this.taskDecomposer = new TaskDecomposer();
    this.agentDiscovery = new AgentDiscoveryService();
    this.communicationManager = new CommunicationManager();
    this.swarmMonitor = new SwarmMonitor();
    
    // Inject reference to this orchestrator into the task execution engine
    taskExecutionEngine.setSwarmOrchestrator(this);
    
    // Load existing sessions from Firestore on startup
    this.loadExistingSessions();
  }

  /**
   * Load existing sessions from Firestore
   */
  private async loadExistingSessions(): Promise<void> {
    try {
      // Since we don't have user context in constructor, we'll load sessions per-user when needed
      console.log('🚀 SwarmOrchestrator initialized - sessions will be loaded per-user');
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }

  /**
   * Load sessions for a specific user from Firestore
   */
  private async loadUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await firestoreSwarmStorage.loadUserSessions(userId);
      
      // Add sessions to in-memory cache
      for (const session of sessions) {
        if (session.status === 'active' || session.status === 'forming' || session.status === 'completing') {
          this.activeSessions.set(session.sessionId, session);
        }
      }
      
      console.log(`📁 Loaded ${sessions.length} sessions for user ${userId}`);
    } catch (error) {
      console.error('Error loading user sessions:', error);
    }
  }

  /**
   * Form a new swarm for a complex task
   */
  async formSwarm(task: ComplexTask, userId: string): Promise<SwarmSession> {
    console.log('🎯 Forming swarm for task:', task.description);

    try {
      // Load user's existing sessions first
      await this.loadUserSessions(userId);

      // Step 1: Decompose the task
      const decomposition = await this.taskDecomposer.decomposeTask(task);
      const taskWithDecomposition = { ...task, decomposition };

      // Step 2: Identify required capabilities
      const requiredCapabilities = await this.taskDecomposer.identifyRequiredCapabilities(decomposition);

      // Step 3: Find and select optimal agents
      const candidateAgents = await this.agentDiscovery.findCandidateAgents({
        capabilities: requiredCapabilities,
        maxResults: 20,
        availabilityRequired: true,
        sortBy: 'performance'
      }, userId);

      const selectedAgents = await this.selectOptimalAgents(taskWithDecomposition, candidateAgents);

      if (selectedAgents.length === 0) {
        throw new Error('No suitable agents found for this task');
      }

      // Step 4: Select coordinator agent
      const coordinatorAgent = this.selectCoordinatorAgent(selectedAgents);

      // Step 5: Create swarm session with new result format
      const sessionId = uuidv4();
      const timestamp = new Date().toISOString();
      
      const session: SwarmSession = {
        sessionId,
        userId,
        activeAgents: selectedAgents.map(a => a.agentId),
        coordinatorAgent: coordinatorAgent.agentId,
        task: taskWithDecomposition,
        status: 'forming',
        messageLog: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        results: [],
        metadata: {
          contentType: 'swarm_result',
          contentId: sessionId,
          userId,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          status: 'active',
          chunkIndex: 0,
          totalChunks: 1,
          isFirstChunk: true,
          access: 'personal',
          primaryCategory: 'swarm_execution',
          secondaryCategories: [],
          tags: ['swarm', task.category || 'general'],
          title: `Swarm Session: ${task.title || task.description.substring(0, 50)}`,
          text: task.description,
          searchableText: `${task.title || ''} ${task.description} ${task.category || 'general'}`,
          keywords: [task.category || 'general', ...requiredCapabilities],
          language: 'en',
          relatedIds: [],
          references: []
        }
      };

      // Step 6: Initialize communication channels
      await this.communicationManager.initializeSwarmCommunication(session);

      // Step 7: Assign tasks to agents
      await this.assignTasksToAgents(session, selectedAgents);

      // Step 8: Start monitoring
      this.swarmMonitor.startMonitoring(session);

      // Step 9: Activate the swarm
      session.status = 'active';
      this.activeSessions.set(sessionId, session);
      
      // Save to Firestore
      await firestoreSwarmStorage.saveSession(session);

      // Step 10: Initialize task execution engine
      await taskExecutionEngine.initializeSession(session);

      console.log('✅ Swarm formed successfully:', {
        sessionId,
        agentCount: selectedAgents.length,
        coordinator: coordinatorAgent.name
      });

      return session;
    } catch (error) {
      console.error('❌ Failed to form swarm:', error);
      throw error;
    }
  }

  /**
   * Select optimal agents for a task using advanced scoring algorithm
   */
  async selectOptimalAgents(task: ComplexTask, candidates: SwarmCapableAgent[]): Promise<SwarmCapableAgent[]> {
    console.log('🧮 Selecting optimal agents from', candidates.length, 'candidates');

    // Score each agent based on multiple factors
    const scoredAgents = candidates.map(agent => {
      const score = this.calculateAgentScore(agent, task);
      return { agent, score };
    }).sort((a, b) => b.score - a.score);

    // Select diverse set of agents to avoid redundancy
    const selectedAgents: SwarmCapableAgent[] = [];
    const maxAgents = Math.min(5, Math.max(2, Math.ceil(task.decomposition?.subTasks.length || 0 / 2)));
    const selectedCapabilities = new Set<string>();

    for (const { agent, score } of scoredAgents) {
      if (selectedAgents.length >= maxAgents) break;

      // Check if this agent adds unique value
      const agentCapabilities = agent.capabilities.map(c => c.name);
      const uniqueCapabilities = agentCapabilities.filter(cap => !selectedCapabilities.has(cap));

      if (uniqueCapabilities.length > 0 || selectedAgents.length === 0) {
        selectedAgents.push(agent);
        agentCapabilities.forEach(cap => selectedCapabilities.add(cap));
        console.log(`✓ Selected agent: ${agent.name} (score: ${score.toFixed(2)})`);
      }
    }

    return selectedAgents;
  }

  /**
   * Calculate agent score for task suitability
   */
  private calculateAgentScore(agent: SwarmCapableAgent, task: ComplexTask): number {
    let score = 0;

    // Capability matching (40% of score)
    const requiredCapabilities = task.requirements
      .filter(req => req.type === 'capability')
      .map(req => req.value);

    const agentCapabilities = agent.capabilities.map(c => c.name);
    const matchingCapabilities = requiredCapabilities.filter(req => 
      agentCapabilities.some(cap => cap.toLowerCase().includes(req.toLowerCase()))
    );

    const capabilityScore = (matchingCapabilities.length / Math.max(requiredCapabilities.length, 1)) * 40;
    score += capabilityScore;

    // Performance metrics (30% of score)
    const performanceScore = (
      agent.taskCompletionRate * 0.4 +
      agent.userSatisfactionScore * 0.3 +
      agent.collaborationScore * 0.3
    ) * 30;
    score += performanceScore;

    // Trust and reliability (20% of score)
    const trustScore = agent.trustScore * 20;
    score += trustScore;

    // Availability and load (10% of score)
    const loadFactor = Math.max(0, 1 - (agent.currentSwarmLoad / agent.maxConcurrentSwarms));
    const availabilityScore = loadFactor * 10;
    score += availabilityScore;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Select the best coordinator agent from the selected agents
   */
  private selectCoordinatorAgent(agents: SwarmCapableAgent[]): SwarmCapableAgent {
    return agents.reduce((best, current) => {
      const bestCoordinationScore = this.getCoordinationScore(best);
      const currentCoordinationScore = this.getCoordinationScore(current);
      
      return currentCoordinationScore > bestCoordinationScore ? current : best;
    });
  }

  /**
   * Calculate coordination score for an agent
   */
  private getCoordinationScore(agent: SwarmCapableAgent): number {
    const coordinatorRole = agent.preferredRoles.find(role => role.name === 'coordinator');
    const coordinatorProficiency = coordinatorRole ? coordinatorRole.proficiency : 0;
    
    return (
      coordinatorProficiency * 0.4 +
      agent.collaborationScore * 0.3 +
      agent.trustScore * 0.2 +
      agent.taskCompletionRate * 0.1
    );
  }

  /**
   * Assign subtasks to agents in the swarm
   */
  private async assignTasksToAgents(session: SwarmSession, agents: SwarmCapableAgent[]): Promise<void> {
    if (!session.task.decomposition) {
      throw new Error('Task decomposition required for assignment');
    }

    const { subTasks } = session.task.decomposition;
    const assignments = new Map<string, string>(); // taskId -> agentId

    // Assign tasks based on agent capabilities and availability
    for (const subTask of subTasks) {
      const bestAgent = this.findBestAgentForSubTask(subTask, agents, assignments);
      if (bestAgent) {
        assignments.set(subTask.id, bestAgent.agentId);
        subTask.assignedAgentId = bestAgent.agentId;
      }
    }

    // Send task assignments to agents
    for (const [taskId, agentId] of Array.from(assignments.entries())) {
      const subTask = subTasks.find(t => t.id === taskId);
      if (subTask) {
        await this.communicationManager.sendTaskAssignment(session.sessionId, agentId, subTask);
      }
    }
  }

  /**
   * Find the best agent for a specific subtask
   */
  private findBestAgentForSubTask(
    subTask: SubTask, 
    agents: SwarmCapableAgent[], 
    existingAssignments: Map<string, string>
  ): SwarmCapableAgent | null {
    // Calculate load for each agent
    const agentLoads = new Map<string, number>();
    for (const [_, agentId] of Array.from(existingAssignments.entries())) {
      agentLoads.set(agentId, (agentLoads.get(agentId) || 0) + 1);
    }

    // Score agents for this specific subtask
    const scoredAgents = agents.map(agent => {
      const currentLoad = agentLoads.get(agent.agentId) || 0;
      const loadPenalty = currentLoad * 10; // Penalize overloaded agents
      
      // Simple capability matching for subtask
      const relevanceScore = this.calculateSubTaskRelevance(agent, subTask);
      const finalScore = relevanceScore - loadPenalty;
      
      return { agent, score: finalScore };
    }).sort((a, b) => b.score - a.score);

    return scoredAgents.length > 0 ? scoredAgents[0].agent : null;
  }

  /**
   * Calculate how relevant an agent is for a specific subtask
   */
  private calculateSubTaskRelevance(agent: SwarmCapableAgent, subTask: SubTask): number {
    const taskKeywords = subTask.description.toLowerCase().split(' ');
    let relevanceScore = 0;

    // Check capabilities
    for (const capability of agent.capabilities) {
      const capabilityKeywords = capability.name.toLowerCase().split(' ');
      const matches = taskKeywords.filter(keyword => 
        capabilityKeywords.some(capKeyword => capKeyword.includes(keyword))
      );
      relevanceScore += matches.length * capability.proficiencyLevel;
    }

    // Check specializations
    for (const specialization of agent.specializations) {
      const specKeywords = specialization.domain.toLowerCase().split(' ');
      const matches = taskKeywords.filter(keyword => 
        specKeywords.some(specKeyword => specKeyword.includes(keyword))
      );
      const levelMultiplier = specialization.level === 'master' ? 4 : 
                             specialization.level === 'expert' ? 3 : 
                             specialization.level === 'intermediate' ? 2 : 1;
      relevanceScore += matches.length * levelMultiplier * 10;
    }

    return relevanceScore;
  }

  /**
   * Coordinate handoff between agents
   */
  async coordinateAgentHandoff(
    fromAgentId: string, 
    toAgentId: string, 
    context: any, 
    sessionId: string
  ): Promise<void> {
    console.log('🔄 Coordinating handoff:', fromAgentId, '->', toAgentId);

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Create handoff message
    const handoffMessage: AgentMessage = {
      id: uuidv4(),
      fromAgentId,
      toAgentId,
      messageType: 'result_handoff',
      payload: {
        context,
        timestamp: Date.now(),
        handoffType: 'task_completion'
      },
      timestamp: Date.now(),
      priority: 'high',
      sessionId,
      requiresResponse: true
    };

    // Send handoff message
    await this.communicationManager.sendMessage(handoffMessage);

    // Update session message log
    session.messageLog.push(handoffMessage);
    session.lastActivity = Date.now();

    console.log('✅ Handoff completed successfully');
  }

  /**
   * Monitor swarm health and performance
   */
  async monitorSwarmHealth(sessionId: string): Promise<SwarmHealthReport> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return await this.swarmMonitor.generateHealthReport(session);
  }

  /**
   * Dissolve a swarm session
   */
  async dissolveSwarm(sessionId: string): Promise<void> {
    console.log('🔚 Dissolving swarm:', sessionId);

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      // Stop monitoring
      this.swarmMonitor.stopMonitoring(sessionId);

      // Stop task execution
      taskExecutionEngine.stopSession(sessionId);

      // Send dissolution messages to all agents
      await this.communicationManager.notifySwarmDissolution(session);

      // Calculate final performance metrics
      const performanceMetrics = await this.calculateFinalPerformanceMetrics(session);
      session.performanceMetrics = performanceMetrics;

      // Update session status
      session.status = 'dissolved';
      session.completedAt = Date.now();

      // Save final state to Firestore before removing from memory
      await firestoreSwarmStorage.saveSession(session);

      // Clean up
      this.activeSessions.delete(sessionId);

      console.log('✅ Swarm dissolved successfully');
    } catch (error) {
      console.error('❌ Error dissolving swarm:', error);
      session.status = 'error';
      
      // Save error state to Firestore
      await firestoreSwarmStorage.saveSession(session);
      throw error;
    }
  }

  /**
   * Calculate final performance metrics for a completed swarm
   */
  private async calculateFinalPerformanceMetrics(session: SwarmSession): Promise<SwarmPerformanceMetrics> {
    const duration = Date.now() - session.createdAt;
    const completedTasks = session.task.decomposition?.subTasks.filter(t => t.status === 'completed').length || 0;
    const totalTasks = session.task.decomposition?.subTasks.length || 1;

    // Calculate agent utilization
    const agentUtilization: Record<string, number> = {};
    for (const agentId of session.activeAgents) {
      const agentMessages = session.messageLog.filter(m => m.fromAgentId === agentId).length;
      agentUtilization[agentId] = agentMessages / session.messageLog.length;
    }

    // Calculate communication efficiency
    const uniqueMessageTypes = new Set(session.messageLog.map(m => m.messageType)).size;
    const communicationEfficiency = Math.min(100, (uniqueMessageTypes / session.messageLog.length) * 100);

    return {
      totalDuration: duration,
      agentUtilization,
      communicationEfficiency,
      taskCompletionRate: (completedTasks / totalTasks) * 100,
      resourceUsage: {
        computeTime: duration,
        memoryUsage: 0, // TODO: Implement actual memory tracking
        apiCalls: session.messageLog.length,
        tokenUsage: 0, // TODO: Track token usage
        cost: 0 // TODO: Calculate actual cost
      },
      collaborationScore: this.calculateCollaborationScore(session)
    };
  }

  /**
   * Calculate collaboration score based on message patterns
   */
  private calculateCollaborationScore(session: SwarmSession): number {
    const messages = session.messageLog;
    if (messages.length === 0) return 0;

    // Analyze message patterns for collaboration indicators
    const coordinationMessages = messages.filter(m => m.messageType === 'coordination').length;
    const dataShareMessages = messages.filter(m => m.messageType === 'data_share').length;
    const handoffMessages = messages.filter(m => m.messageType === 'result_handoff').length;

    const collaborationRatio = (coordinationMessages + dataShareMessages + handoffMessages) / messages.length;
    return Math.min(100, collaborationRatio * 100);
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<SwarmSession[]> {
    // Load user's sessions from Firestore first
    await this.loadUserSessions(userId);
    
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SwarmSession | undefined> {
    // Try to get from memory first
    let session = this.activeSessions.get(sessionId);
    
    // If not in memory, try to load from Firestore
    if (!session) {
      const firestoreSession = await firestoreSwarmStorage.loadSession(sessionId);
      if (firestoreSession && (firestoreSession.status === 'active' || firestoreSession.status === 'forming' || firestoreSession.status === 'completing')) {
        this.activeSessions.set(sessionId, firestoreSession);
        session = firestoreSession;
      }
    }
    
    return session;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: SwarmSession['status']): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastActivity = Date.now();
      
      // Save to Firestore
      await firestoreSwarmStorage.saveSession(session);
    }
  }

  /**
   * Add result to session
   */
  async addResult(sessionId: string, result: SwarmResult): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (!session.results) {
        session.results = [];
      }
      session.results.push(result);
      session.lastActivity = Date.now();
      
      // Save to Firestore
      await firestoreSwarmStorage.saveSession(session);
    }
  }
} 