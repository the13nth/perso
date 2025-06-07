import { 
  SwarmSession, 
  SwarmHealthReport, 
  AgentHealthStatus,
  CommunicationHealthMetrics,
  TaskProgressMetrics,
  SwarmIssue
} from '@/types/swarm';

export class SwarmMonitor {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthHistory: Map<string, SwarmHealthReport[]> = new Map();
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly MAX_HEALTH_HISTORY = 100; // Keep last 100 reports

  /**
   * Start monitoring a swarm session
   */
  startMonitoring(session: SwarmSession): void {
    console.log('📊 Starting swarm monitoring for session:', session.sessionId);

    const interval = setInterval(async () => {
      try {
        const healthReport = await this.generateHealthReport(session);
        this.storeHealthReport(session.sessionId, healthReport);
        
        // Check for critical issues
        const criticalIssues = healthReport.issues.filter(issue => issue.severity === 'critical');
        if (criticalIssues.length > 0) {
          console.warn('🚨 Critical issues detected in swarm:', session.sessionId, criticalIssues);
          await this.handleCriticalIssues(session, criticalIssues);
        }
      } catch (error) {
        console.error('❌ Error monitoring swarm:', session.sessionId, error);
      }
    }, this.MONITORING_INTERVAL);

    this.monitoringIntervals.set(session.sessionId, interval);
  }

  /**
   * Stop monitoring a swarm session
   */
  stopMonitoring(sessionId: string): void {
    console.log('🛑 Stopping swarm monitoring for session:', sessionId);

    const interval = this.monitoringIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(sessionId);
    }
  }

  /**
   * Generate comprehensive health report for a swarm
   */
  async generateHealthReport(session: SwarmSession): Promise<SwarmHealthReport> {
    console.log('🏥 Generating health report for session:', session.sessionId);

    const timestamp = Date.now();
    
    // Analyze agent health
    const agentHealth = this.analyzeAgentHealth(session);
    
    // Analyze communication health
    const communicationHealth = this.analyzeCommunicationHealth(session);
    
    // Analyze task progress
    const taskProgress = this.analyzeTaskProgress(session);
    
    // Detect issues
    const issues = this.detectIssues(session, agentHealth, communicationHealth, taskProgress);
    
    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(agentHealth, communicationHealth, taskProgress, issues);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, session);

    const healthReport: SwarmHealthReport = {
      sessionId: session.sessionId,
      timestamp,
      overallHealth,
      agentHealth,
      communicationHealth,
      taskProgress,
      issues,
      recommendations
    };

    return healthReport;
  }

  /**
   * Analyze the health of individual agents in the swarm
   */
  private analyzeAgentHealth(session: SwarmSession): AgentHealthStatus[] {
    const agentHealthStatuses: AgentHealthStatus[] = [];
    const currentTime = Date.now();

    for (const agentId of session.activeAgents) {
      // Calculate agent-specific metrics
      const agentMessages = session.messageLog.filter(msg => msg.fromAgentId === agentId);
      const lastActivity = agentMessages.length > 0 
        ? Math.max(...agentMessages.map(msg => msg.timestamp))
        : session.createdAt;

      // Calculate response time
      const responseTimes = this.calculateAgentResponseTimes(session, agentId);
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;

      // Calculate task load
      const assignedTasks = session.task.decomposition?.subTasks.filter(task => task.assignedAgentId === agentId) || [];
      const taskLoad = assignedTasks.length;

      // Calculate error rate
      const errorRate = this.calculateAgentErrorRate(session, agentId);

      // Determine agent status
      const timeSinceLastActivity = currentTime - lastActivity;
      let status: AgentHealthStatus['status'] = 'active';
      
      if (timeSinceLastActivity > 300000) { // 5 minutes
        status = 'unresponsive';
      } else if (taskLoad > 3) {
        status = 'overloaded';
      } else if (timeSinceLastActivity > 60000) { // 1 minute
        status = 'idle';
      } else if (errorRate > 0.2) {
        status = 'error';
      }

      agentHealthStatuses.push({
        agentId,
        status,
        responseTime: averageResponseTime,
        taskLoad,
        errorRate: errorRate * 100, // Convert to percentage
        lastActivity
      });
    }

    return agentHealthStatuses;
  }

  /**
   * Analyze communication health metrics
   */
  private analyzeCommunicationHealth(session: SwarmSession): CommunicationHealthMetrics {
    const messages = session.messageLog;
    const messageVolume = messages.length;
    
    // Calculate average response time for messages requiring responses
    const responseTimes = this.calculateMessageResponseTimes(session);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    // Calculate failed message rate (simulated for now)
    const failedMessageRate = 0; // TODO: Implement actual tracking

    // Calculate coordination efficiency
    const coordinationMessages = messages.filter(msg => 
      msg.messageType === 'coordination' || 
      msg.messageType === 'result_handoff' || 
      msg.messageType === 'data_share'
    );
    const coordinationEfficiency = messageVolume > 0 
      ? (coordinationMessages.length / messageVolume) * 100 
      : 0;

    // Detect communication bottlenecks
    const bottlenecks = this.detectCommunicationBottlenecks(session);

    return {
      messageVolume,
      averageResponseTime,
      failedMessageRate,
      coordinationEfficiency,
      bottlenecks
    };
  }

  /**
   * Analyze task progress metrics
   */
  private analyzeTaskProgress(session: SwarmSession): TaskProgressMetrics {
    const subTasks = session.task.decomposition?.subTasks || [];
    const completedSubTasks = subTasks.filter(task => task.status === 'completed').length;
    const totalSubTasks = subTasks.length;
    
    // Calculate estimated time remaining
    const inProgressTasks = subTasks.filter(task => task.status === 'in_progress');
    const pendingTasks = subTasks.filter(task => task.status === 'pending');
    
    const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(inProgressTasks, pendingTasks);
    
    // Find blocked tasks
    const blockedTasks = subTasks
      .filter(task => task.status === 'failed')
      .map(task => task.id);

    // Calculate critical path progress
    const criticalTasks = subTasks.filter(task => task.status === 'completed');
    const criticalPathProgress = totalSubTasks > 0 
      ? (criticalTasks.length / totalSubTasks) * 100 
      : 0;

    return {
      completedSubTasks,
      totalSubTasks,
      estimatedTimeRemaining,
      blockedTasks,
      criticalPathProgress
    };
  }

  /**
   * Detect various types of issues in the swarm
   */
  private detectIssues(
    session: SwarmSession,
    agentHealth: AgentHealthStatus[],
    communicationHealth: CommunicationHealthMetrics,
    taskProgress: TaskProgressMetrics
  ): SwarmIssue[] {
    const issues: SwarmIssue[] = [];
    const currentTime = Date.now();

    // Agent-related issues
    const unresponsiveAgents = agentHealth.filter(agent => agent.status === 'unresponsive');
    if (unresponsiveAgents.length > 0) {
      issues.push({
        type: 'performance',
        severity: 'high',
        description: `${unresponsiveAgents.length} agent(s) are unresponsive`,
        affectedAgents: unresponsiveAgents.map(agent => agent.agentId),
        suggestedActions: ['Check agent connectivity', 'Reassign tasks to available agents'],
        timestamp: currentTime
      });
    }

    const overloadedAgents = agentHealth.filter(agent => agent.status === 'overloaded');
    if (overloadedAgents.length > 0) {
      issues.push({
        type: 'resource',
        severity: 'medium',
        description: `${overloadedAgents.length} agent(s) are overloaded`,
        affectedAgents: overloadedAgents.map(agent => agent.agentId),
        suggestedActions: ['Redistribute tasks', 'Add more agents to swarm'],
        timestamp: currentTime
      });
    }

    // Communication issues
    if (communicationHealth.averageResponseTime > 5000) { // 5 seconds
      issues.push({
        type: 'communication',
        severity: 'medium',
        description: 'High communication latency detected',
        affectedAgents: session.activeAgents,
        suggestedActions: ['Check network connectivity', 'Optimize message routing'],
        timestamp: currentTime
      });
    }

    if (communicationHealth.coordinationEfficiency < 20) {
      issues.push({
        type: 'coordination',
        severity: 'low',
        description: 'Low coordination efficiency',
        affectedAgents: session.activeAgents,
        suggestedActions: ['Improve coordination protocols', 'Add coordination agent'],
        timestamp: currentTime
      });
    }

    // Task progress issues
    if (taskProgress.blockedTasks.length > 0) {
      issues.push({
        type: 'logic',
        severity: 'high',
        description: `${taskProgress.blockedTasks.length} task(s) are blocked`,
        affectedAgents: [],
        suggestedActions: ['Resolve task dependencies', 'Reassign blocked tasks'],
        timestamp: currentTime
      });
    }

    // Time-based issues
    const sessionDuration = currentTime - session.createdAt;
    const expectedDuration = (session.task.decomposition?.subTasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0) || 0) * 60000;
    
    if (sessionDuration > expectedDuration * 1.5) { // 50% over expected time
      issues.push({
        type: 'performance',
        severity: 'medium',
        description: 'Swarm execution is taking longer than expected',
        affectedAgents: session.activeAgents,
        suggestedActions: ['Review task complexity', 'Add more capable agents'],
        timestamp: currentTime
      });
    }

    return issues;
  }

  /**
   * Calculate overall health score for the swarm
   */
  private calculateOverallHealth(
    agentHealth: AgentHealthStatus[],
    communicationHealth: CommunicationHealthMetrics,
    taskProgress: TaskProgressMetrics,
    issues: SwarmIssue[]
  ): SwarmHealthReport['overallHealth'] {
    let score = 100;

    // Deduct points for agent issues
    const criticalAgentIssues = agentHealth.filter(agent => 
      agent.status === 'unresponsive' || agent.status === 'error'
    ).length;
    score -= criticalAgentIssues * 20;

    const minorAgentIssues = agentHealth.filter(agent => 
      agent.status === 'overloaded' || agent.status === 'idle'
    ).length;
    score -= minorAgentIssues * 10;

    // Deduct points for communication issues
    if (communicationHealth.averageResponseTime > 5000) score -= 15;
    if (communicationHealth.coordinationEfficiency < 30) score -= 10;

    // Deduct points for task progress issues
    if (taskProgress.blockedTasks.length > 0) score -= taskProgress.blockedTasks.length * 15;

    // Deduct points for critical issues
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    score -= criticalIssues * 25;

    const highIssues = issues.filter(issue => issue.severity === 'high').length;
    score -= highIssues * 15;

    // Determine health category
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Generate recommendations based on detected issues
   */
  private generateRecommendations(issues: SwarmIssue[], session: SwarmSession): string[] {
    const recommendations: string[] = [];

    // Priority: Critical and High severity issues first
    const priorityIssues = issues.filter(issue => 
      issue.severity === 'critical' || issue.severity === 'high'
    );

    for (const issue of priorityIssues) {
      recommendations.push(...issue.suggestedActions);
    }

    // Add general optimization recommendations
    if (issues.length === 0) {
      recommendations.push('Swarm is operating optimally');
    } else if (issues.filter(issue => issue.type === 'performance').length > 0) {
      recommendations.push('Consider optimizing agent workload distribution');
    }

    if (session.messageLog.length < 5) {
      recommendations.push('Encourage more agent collaboration and communication');
    }

    // Remove duplicates and limit to top 5
    return Array.from(new Set(recommendations)).slice(0, 5);
  }

  /**
   * Handle critical issues that require immediate attention
   */
  private async handleCriticalIssues(session: SwarmSession, issues: SwarmIssue[]): Promise<void> {
    for (const issue of issues) {
      console.warn(`🚨 Handling critical issue in swarm ${session.sessionId}:`, issue.description);
      
      // Implement automatic remediation for critical issues
      switch (issue.type) {
        case 'communication':
          // Attempt to re-establish communication channels
          await this.attemptCommunicationRecovery(session, issue.affectedAgents);
          break;
        case 'performance':
          // Try to redistribute workload
          await this.attemptWorkloadRedistribution(session, issue.affectedAgents);
          break;
        case 'logic':
          // Try to resolve logical issues
          await this.attemptLogicResolution(session, issue);
          break;
      }
    }
  }

  // Helper methods for calculations and analysis

  private calculateAgentResponseTimes(session: SwarmSession, agentId: string): number[] {
    // Simplified response time calculation
    const agentMessages = session.messageLog.filter(msg => msg.fromAgentId === agentId);
    return agentMessages.map(() => 1000 + Math.random() * 2000); // Simulated response times
  }

  private calculateAgentErrorRate(_session: SwarmSession, _agentId: string): number {
    // Simplified error rate calculation
    return Math.random() * 0.1; // Simulated error rate (0-10%)
  }

  private calculateMessageResponseTimes(session: SwarmSession): number[] {
    // Simplified message response time calculation
    return session.messageLog
      .filter(msg => msg.requiresResponse)
      .map(() => 1000 + Math.random() * 3000); // Simulated response times
  }

  private detectCommunicationBottlenecks(session: SwarmSession): string[] {
    const bottlenecks: string[] = [];
    
    // Detect agents with high message volume
    const messagesByAgent = new Map<string, number>();
    session.messageLog.forEach(msg => {
      messagesByAgent.set(msg.fromAgentId, (messagesByAgent.get(msg.fromAgentId) || 0) + 1);
    });

    for (const [agentId, messageCount] of Array.from(messagesByAgent)) {
      if (messageCount > session.messageLog.length * 0.4) { // Agent sending >40% of messages
        bottlenecks.push(`Agent ${agentId} is generating high message volume`);
      }
    }

    return bottlenecks;
  }

  private calculateEstimatedTimeRemaining(inProgressTasks: any[], pendingTasks: any[]): number {
    const inProgressTime = inProgressTasks.reduce((sum, task) => {
      const elapsed = task.startedAt ? Date.now() - task.startedAt : 0;
      const remaining = Math.max(0, (task.estimatedDuration * 60000) - elapsed);
      return sum + remaining;
    }, 0);

    const pendingTime = pendingTasks.reduce((sum, task) => sum + (task.estimatedDuration * 60000), 0);

    return inProgressTime + pendingTime;
  }

  private storeHealthReport(sessionId: string, report: SwarmHealthReport): void {
    if (!this.healthHistory.has(sessionId)) {
      this.healthHistory.set(sessionId, []);
    }

    const history = this.healthHistory.get(sessionId)!;
    history.push(report);

    // Keep only the most recent reports
    if (history.length > this.MAX_HEALTH_HISTORY) {
      history.shift();
    }
  }

  // Placeholder methods for critical issue handling
  private async attemptCommunicationRecovery(_session: SwarmSession, affectedAgents: string[]): Promise<void> {
    console.log('🔧 Attempting communication recovery for agents:', affectedAgents);
    // TODO: Implement communication recovery logic
  }

  private async attemptWorkloadRedistribution(_session: SwarmSession, affectedAgents: string[]): Promise<void> {
    console.log('⚖️ Attempting workload redistribution for agents:', affectedAgents);
    // TODO: Implement workload redistribution logic
  }

  private async attemptLogicResolution(_session: SwarmSession, issue: SwarmIssue): Promise<void> {
    console.log('🧠 Attempting logic resolution for issue:', issue.description);
    // TODO: Implement logic resolution
  }

  /**
   * Get health history for a session
   */
  getHealthHistory(sessionId: string): SwarmHealthReport[] {
    return this.healthHistory.get(sessionId) || [];
  }

  /**
   * Get current health status for all monitored sessions
   */
  getAllSessionHealthStatuses(): Record<string, SwarmHealthReport['overallHealth']> {
    const statuses: Record<string, SwarmHealthReport['overallHealth']> = {};
    
    for (const [sessionId, reports] of Array.from(this.healthHistory)) {
      if (reports.length > 0) {
        statuses[sessionId] = reports[reports.length - 1].overallHealth;
      }
    }

    return statuses;
  }
} 