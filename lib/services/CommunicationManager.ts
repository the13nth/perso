import { v4 as uuidv4 } from 'uuid';
import { 
  SwarmSession, 
  AgentMessage, 
  SubTask,
  CommunicationChannel,
  MessageResponse
} from '@/types/swarm';

export class CommunicationManager {
  private channels: Map<string, CommunicationChannel> = new Map();
  private messageHandlers: Map<string, (message: AgentMessage) => Promise<void>> = new Map();

  /**
   * Initialize communication channels for a swarm
   */
  async initializeSwarmCommunication(session: SwarmSession): Promise<void> {
    console.log('📡 Initializing swarm communication for session:', session.sessionId);

    // Create main broadcast channel
    const broadcastChannel: CommunicationChannel = {
      channelId: `broadcast_${session.sessionId}`,
      sessionId: session.sessionId,
      participants: session.activeAgents,
      type: 'broadcast',
      topic: 'swarm_coordination',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    };

    this.channels.set(broadcastChannel.channelId, broadcastChannel);

    // Create direct channels between coordinator and each agent
    for (const agentId of session.activeAgents) {
      if (agentId !== session.coordinatorAgent) {
        const directChannel: CommunicationChannel = {
          channelId: `direct_${session.coordinatorAgent}_${agentId}`,
          sessionId: session.sessionId,
          participants: [session.coordinatorAgent, agentId],
          type: 'direct',
          topic: 'task_coordination',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 0
        };

        this.channels.set(directChannel.channelId, directChannel);
      }
    }

    console.log('✅ Communication channels initialized');
  }

  /**
   * Send a message between agents
   */
  async sendMessage(message: AgentMessage): Promise<MessageResponse> {
    console.log('📤 Sending message:', message.messageType, 'from', message.fromAgentId, 'to', message.toAgentId);

    try {
      const deliveredTo: string[] = [];
      const failedDeliveries: string[] = [];

      // Handle broadcast messages
      if (message.toAgentId === 'broadcast') {
        const broadcastChannel = this.findBroadcastChannel(message.sessionId);
        if (broadcastChannel) {
          for (const participantId of broadcastChannel.participants) {
            if (participantId !== message.fromAgentId) {
              try {
                await this.deliverMessage(message, participantId);
                deliveredTo.push(participantId);
              } catch (_error) {
                console.error(`Failed to deliver to ${participantId}:`, _error);
                failedDeliveries.push(participantId);
              }
            }
          }
          
          // Update channel activity
          broadcastChannel.lastActivity = Date.now();
          broadcastChannel.messageCount++;
        }
      } else {
        // Handle direct messages
        try {
          await this.deliverMessage(message, message.toAgentId);
          deliveredTo.push(message.toAgentId);

          // Update direct channel activity
          const directChannel = this.findDirectChannel(message.fromAgentId, message.toAgentId, message.sessionId);
          if (directChannel) {
            directChannel.lastActivity = Date.now();
            directChannel.messageCount++;
          }
        } catch (_error) {
          console.error(`Failed to deliver to ${message.toAgentId}:`, _error);
          failedDeliveries.push(message.toAgentId);
        }
      }

      const response: MessageResponse = {
        success: failedDeliveries.length === 0,
        messageId: message.id,
        deliveredTo,
        failedDeliveries,
        timestamp: Date.now()
      };

      console.log('✅ Message delivery completed:', response);
      return response;
    } catch (_error) {
      console.error('❌ Message sending failed:', _error);
      return {
        success: false,
        messageId: message.id,
        deliveredTo: [],
        failedDeliveries: [message.toAgentId],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Send task assignment to an agent
   */
  async sendTaskAssignment(sessionId: string, agentId: string, subTask: SubTask): Promise<void> {
    const assignmentMessage: AgentMessage = {
      id: uuidv4(),
      fromAgentId: 'system',
      toAgentId: agentId,
      messageType: 'task_request',
      payload: {
        type: 'task_assignment',
        task: subTask,
        priority: 'high',
        deadline: subTask.estimatedDuration ? Date.now() + (subTask.estimatedDuration * 60 * 1000) : undefined
      },
      timestamp: Date.now(),
      priority: 'high',
      sessionId,
      requiresResponse: true
    };

    await this.sendMessage(assignmentMessage);
  }

  /**
   * Send coordination message to all agents in swarm
   */
  async sendCoordinationMessage(sessionId: string, fromAgentId: string, coordinationData: any): Promise<void> {
    const coordinationMessage: AgentMessage = {
      id: uuidv4(),
      fromAgentId,
      toAgentId: 'broadcast',
      messageType: 'coordination',
      payload: coordinationData,
      timestamp: Date.now(),
      priority: 'medium',
      sessionId,
      requiresResponse: false
    };

    await this.sendMessage(coordinationMessage);
  }

  /**
   * Notify all agents about swarm dissolution
   */
  async notifySwarmDissolution(session: SwarmSession): Promise<void> {
    console.log('📢 Notifying agents about swarm dissolution');

    const dissolutionMessage: AgentMessage = {
      id: uuidv4(),
      fromAgentId: 'system',
      toAgentId: 'broadcast',
      messageType: 'status_update',
      payload: {
        type: 'swarm_dissolution',
        sessionId: session.sessionId,
        finalResults: session.results,
        performanceMetrics: session.performanceMetrics
      },
      timestamp: Date.now(),
      priority: 'high',
      sessionId: session.sessionId,
      requiresResponse: false
    };

    await this.sendMessage(dissolutionMessage);

    // Clean up channels
    this.cleanupSessionChannels(session.sessionId);
  }

  /**
   * Register a message handler for an agent
   */
  registerMessageHandler(agentId: string, handler: (message: AgentMessage) => Promise<void>): void {
    this.messageHandlers.set(agentId, handler);
  }

  /**
   * Unregister a message handler for an agent
   */
  unregisterMessageHandler(agentId: string): void {
    this.messageHandlers.delete(agentId);
  }

  /**
   * Get communication statistics for a session
   */
  getSessionCommunicationStats(sessionId: string): {
    totalMessages: number;
    channelCount: number;
    averageResponseTime: number;
    messagesByType: Record<string, number>;
  } {
    const sessionChannels = Array.from(this.channels.values())
      .filter(channel => channel.sessionId === sessionId);

    const totalMessages = sessionChannels.reduce((sum, channel) => sum + channel.messageCount, 0);
    const channelCount = sessionChannels.length;

    // TODO: Implement actual response time tracking
    const averageResponseTime = 1500; // Placeholder

    // TODO: Implement message type tracking
    const messagesByType: Record<string, number> = {
      'task_request': 0,
      'data_share': 0,
      'result_handoff': 0,
      'coordination': 0,
      'status_update': 0
    };

    return {
      totalMessages,
      channelCount,
      averageResponseTime,
      messagesByType
    };
  }

  /**
   * Deliver message to specific agent
   */
  private async deliverMessage(message: AgentMessage, targetAgentId: string): Promise<void> {
    // Check if agent has a registered handler
    const handler = this.messageHandlers.get(targetAgentId);
    
    if (handler) {
      // Deliver to registered handler
      await handler(message);
    } else {
      // Store message for later delivery (when agent comes online)
      await this.storeMessage(message, targetAgentId);
    }
  }

  /**
   * Store message for offline agent
   */
  private async storeMessage(message: AgentMessage, targetAgentId: string): Promise<void> {
    // TODO: Implement message storage (database, queue, etc.)
    console.log(`📬 Storing message for offline agent ${targetAgentId}:`, message.messageType);
    
    // For now, just log the message
    // In a real implementation, this would store to a persistent queue
  }

  /**
   * Find broadcast channel for a session
   */
  private findBroadcastChannel(sessionId: string): CommunicationChannel | undefined {
    return Array.from(this.channels.values())
      .find(channel => channel.sessionId === sessionId && channel.type === 'broadcast');
  }

  /**
   * Find direct channel between two agents in a session
   */
  private findDirectChannel(agentId1: string, agentId2: string, sessionId: string): CommunicationChannel | undefined {
    return Array.from(this.channels.values())
      .find(channel => 
        channel.sessionId === sessionId && 
        channel.type === 'direct' && 
        channel.participants.includes(agentId1) && 
        channel.participants.includes(agentId2)
      );
  }

  /**
   * Clean up all channels for a session
   */
  private cleanupSessionChannels(sessionId: string): void {
    const sessionChannelIds = Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.sessionId === sessionId)
      .map(([channelId, _]) => channelId);

    for (const channelId of sessionChannelIds) {
      this.channels.delete(channelId);
    }

    console.log(`🧹 Cleaned up ${sessionChannelIds.length} channels for session ${sessionId}`);
  }

  /**
   * Create a group channel for specific agents
   */
  async createGroupChannel(
    sessionId: string, 
    participants: string[], 
    topic?: string
  ): Promise<CommunicationChannel> {
    const groupChannel: CommunicationChannel = {
      channelId: uuidv4(),
      sessionId,
      participants,
      type: 'group',
      topic: topic || 'group_coordination',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    };

    this.channels.set(groupChannel.channelId, groupChannel);
    
    console.log('👥 Created group channel:', groupChannel.channelId, 'for', participants.length, 'participants');
    return groupChannel;
  }

  /**
   * Send status update from an agent
   */
  async sendStatusUpdate(
    sessionId: string, 
    fromAgentId: string, 
    status: string, 
    details?: any
  ): Promise<void> {
    const statusMessage: AgentMessage = {
      id: uuidv4(),
      fromAgentId,
      toAgentId: 'broadcast',
      messageType: 'status_update',
      payload: {
        status,
        details,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      priority: 'low',
      sessionId,
      requiresResponse: false
    };

    await this.sendMessage(statusMessage);
  }

  /**
   * Request capability information from agents
   */
  async requestCapabilityInfo(
    sessionId: string, 
    fromAgentId: string, 
    targetAgentIds: string[]
  ): Promise<void> {
    for (const targetId of targetAgentIds) {
      const capabilityQuery: AgentMessage = {
        id: uuidv4(),
        fromAgentId,
        toAgentId: targetId,
        messageType: 'capability_query',
        payload: {
          queryType: 'capability_info',
          requestedInfo: ['capabilities', 'specializations', 'current_load']
        },
        timestamp: Date.now(),
        priority: 'medium',
        sessionId,
        requiresResponse: true
      };

      await this.sendMessage(capabilityQuery);
    }
  }

  /**
   * Share data between agents
   */
  async shareData(
    sessionId: string,
    fromAgentId: string,
    toAgentId: string,
    data: any,
    dataType: string
  ): Promise<void> {
    const dataShareMessage: AgentMessage = {
      id: uuidv4(),
      fromAgentId,
      toAgentId,
      messageType: 'data_share',
      payload: {
        dataType,
        data,
        timestamp: Date.now(),
        metadata: {
          format: typeof data,
          size: JSON.stringify(data).length
        }
      },
      timestamp: Date.now(),
      priority: 'medium',
      sessionId,
      requiresResponse: false
    };

    await this.sendMessage(dataShareMessage);
  }

  /**
   * Get all channels for a session
   */
  getSessionChannels(sessionId: string): CommunicationChannel[] {
    return Array.from(this.channels.values())
      .filter(channel => channel.sessionId === sessionId);
  }

  /**
   * Check if an agent is reachable
   */
  isAgentReachable(agentId: string): boolean {
    return this.messageHandlers.has(agentId);
  }

  /**
   * Get message queue size for an agent
   */
  getMessageQueueSize(_agentId: string): number {
    // TODO: Implement actual queue size tracking
    // For now, return 0 as messages are delivered immediately
    return 0;
  }
} 