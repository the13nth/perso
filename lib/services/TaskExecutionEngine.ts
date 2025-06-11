import { SwarmSession, SubTask, SwarmResult } from '@/types/swarm';
import { v4 as uuidv4 } from 'uuid';
import { getAgentContext, getAgentConfig } from "@/app/lib/pinecone";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContentMetadata } from '@/app/lib/content/types';

export interface TaskExecution {
  taskId: string;
  agentId: string;
  sessionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: SwarmResult;
  error?: string;
  progress?: number;
  description?: string;
}

export class TaskExecutionEngine {
  private executionQueue: Map<string, TaskExecution[]> = new Map(); // sessionId -> executions
  private runningTasks: Map<string, TaskExecution> = new Map(); // taskId -> execution
  private agents: Map<string, any> = new Map(); // agentId -> agent config
  private swarmOrchestrator: any = null; // Will be injected

  /**
   * Set the swarm orchestrator reference for session updates
   */
  setSwarmOrchestrator(orchestrator: any): void {
    this.swarmOrchestrator = orchestrator;
  }

  /**
   * Initialize the execution engine for a swarm session
   */
  async initializeSession(session: SwarmSession): Promise<void> {
    console.log('🚀 Initializing task execution for session:', session.sessionId);
    
    // Load agent configurations
    await this.loadAgentConfigurations(session.activeAgents);
    
    // Initialize execution queue for this session
    this.executionQueue.set(session.sessionId, []);
    
    // Queue all pending tasks
    if (session.task.decomposition?.subTasks) {
      for (const subTask of session.task.decomposition.subTasks) {
        if (subTask.status === 'pending' && subTask.assignedAgentId) {
          await this.queueTask(session.sessionId, subTask);
        }
      }
    }
    
    // Start processing the queue
    this.processTaskQueue(session.sessionId);
  }

  /**
   * Queue a task for execution
   */
  async queueTask(sessionId: string, subTask: SubTask): Promise<void> {
    if (!subTask.assignedAgentId) {
      throw new Error('Cannot queue task without assigned agent');
    }

    const execution: TaskExecution = {
      taskId: subTask.id,
      agentId: subTask.assignedAgentId,
      sessionId,
      status: 'queued',
      description: subTask.description,
    };

    const sessionQueue = this.executionQueue.get(sessionId) || [];
    sessionQueue.push(execution);
    this.executionQueue.set(sessionId, sessionQueue);

    console.log('📋 Task queued for execution:', {
      taskId: subTask.id,
      agentId: subTask.assignedAgentId,
      description: subTask.description
    });
  }

  /**
   * Process the task queue for a session
   */
  private async processTaskQueue(sessionId: string): Promise<void> {
    const sessionQueue = this.executionQueue.get(sessionId) || [];
    
    // Process queued tasks
    for (const execution of sessionQueue) {
      if (execution.status === 'queued') {
        await this.executeTask(sessionId, execution);
      }
    }

    // Set up periodic processing
    setTimeout(() => {
      if (this.executionQueue.has(sessionId)) {
        this.processTaskQueue(sessionId);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Execute a single task
   */
  private async executeTask(sessionId: string, execution: TaskExecution): Promise<void> {
    console.log('⚙️ Executing task:', execution.taskId, 'with agent:', execution.agentId);

    try {
      // Update execution status to running
      execution.status = 'running';
      execution.startTime = Date.now();
      execution.progress = 0;
      this.runningTasks.set(execution.taskId, execution);

      // Update task status in session to in_progress
      await this.updateTaskStatus(sessionId, execution.taskId, 'in_progress');

      // Get agent configuration
      const agent = this.agents.get(execution.agentId);
      if (!agent) {
        throw new Error(`Agent configuration not found: ${execution.agentId}`);
      }

      // Create mock task for execution
      const taskDetails: SubTask = {
        id: execution.taskId,
        description: execution.description || 'Task execution',
        status: 'in_progress',
        assignedAgentId: execution.agentId,
        parentTaskId: execution.taskId,
        startTime: Date.now()
      };

      // Execute the task with the agent
      const result = await this.executeTaskWithAgent(agent, taskDetails);

      // Mark execution as completed
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.result = result;
      execution.progress = 100;

      // Update task status in session to completed
      await this.updateTaskStatus(sessionId, execution.taskId, 'completed', result);

      console.log('✅ Task execution completed:', execution.taskId);

    } catch (error) {
      console.error('❌ Task execution failed:', execution.taskId, error);
      
      // Mark execution as failed
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.progress = 0;

      // Update task status in session to failed
      await this.updateTaskStatus(sessionId, execution.taskId, 'failed', undefined, execution.error);

    } finally {
      // Remove from running tasks
      this.runningTasks.delete(execution.taskId);
    }
  }

  /**
   * Execute a task using an agent through the chat interface
   */
  private async executeTaskWithAgent(agent: any, task: SubTask): Promise<SwarmResult> {
    console.log('🤖 Executing with agent:', agent.name, 'task:', task.description);
    const execution = this.runningTasks.get(task.id);
    if (execution) execution.progress = 25;

    try {
      if (execution) execution.progress = 50;
      // Retrieve context for this agent and subtask
      let contextSnippets: string[] = [];
      try {
        const contextDocs = await getAgentContext(agent.agentId, task.description);
        contextSnippets = contextDocs.slice(0, 3).map(doc => doc.pageContent);
      } catch (err) {
        console.warn('No context found or error retrieving context:', err);
      }

      // Build prompt with context
      const contextSection = contextSnippets.length > 0
        ? `Relevant context for this task:\n${contextSnippets.map((c, i) => `[Context ${i+1}]: ${c}`).join('\n\n')}\n\n` : '';

      const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY_GEMINI;
      if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

      // Use the official SDK with correct method
      const ai = new GoogleGenerativeAI(apiKey);
      const prompt = `${contextSection}${task.description}`;
      const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      const result = await model.generateContent(prompt);
      
      if (!result.response) {
        throw new Error('No response from AI model');
      }

      const responseText = result.response.text();
      if (execution) execution.progress = 75;

      // Create default execution if none exists
      const taskExecution = execution || {
        taskId: task.id,
        agentId: agent.agentId,
        sessionId: task.parentTaskId || '',
        status: 'completed'
      };

      // Create properly formatted result with metadata
      const metadata: ContentMetadata = {
        contentId: uuidv4(),
        contentType: 'swarm_result' as const,
        userId: taskExecution.sessionId.split('-')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1.0,
        status: 'active',
        chunkIndex: 0,
        totalChunks: 1,
        isFirstChunk: true,
        access: 'personal',
        sharedWith: [],
        primaryCategory: 'ai-output',
        secondaryCategories: [],
        title: task.description.slice(0, 100),
        text: responseText,
        searchableText: responseText,
        keywords: ['agent-response', 'swarm-task'],
        language: 'en',
        tags: ['agent-response', 'swarm-task'],
        relatedIds: [],
        references: [],
        swarm: {
          agentId: agent.agentId,
          taskId: task.id,
          confidence: 0.95,
          resultType: 'final',
          performanceMetrics: {
            processingTime: Date.now() - (execution?.startTime || Date.now()),
            resourceUsage: 0,
            qualityScore: 0.95
          }
        }
      };

      return await this.createTaskResult(taskExecution, {
        content: responseText,
        metadata
      }, 0.95, 'final');

    } catch (error) {
      console.error('Error executing task with agent:', error);
      throw error;
    }
  }

  /**
   * Load agent configurations from the API
   */
  private async loadAgentConfigurations(agentIds: string[]): Promise<void> {
    console.log('📖 Loading agent configurations for:', agentIds);
    for (const agentId of agentIds) {
      try {
        const agentConfig = await getAgentConfig(agentId);
        this.agents.set(agentId, agentConfig);
        console.log('✅ Loaded agent configuration:', agentConfig.name);
      } catch (error) {
        console.error('❌ Failed to load agent configuration:', agentId, error);
      }
    }
  }

  /**
   * Update task status in the session
   */
  private async updateTaskStatus(
    sessionId: string, 
    taskId: string, 
    status: SubTask['status'], 
    result?: any,
    error?: string
  ): Promise<void> {
    try {
      console.log('🔄 Updating task status:', { sessionId, taskId, status, resultPreview: result ? JSON.stringify(result).substring(0, 100) : 'null' });
      if (this.swarmOrchestrator) {
        // Get the current session
        const session = await this.swarmOrchestrator.getSession(sessionId);
        if (session && session.task.decomposition?.subTasks) {
          // Find and update the specific task
          const taskIndex = session.task.decomposition.subTasks.findIndex(
            (task: SubTask) => task.id === taskId
          );
          if (taskIndex !== -1) {
            const task = session.task.decomposition.subTasks[taskIndex];
            // Update task properties
            task.status = status;
            if (status === 'in_progress' && !task.startTime) {
              task.startTime = Date.now();
            }
            if (result) {
              // Extract the actual response text if it's wrapped in an object
              if (typeof result === 'object' && result.agentResponse) {
                task.result = result.agentResponse; // Store just the text content
              } else {
                task.result = result;
              }
              console.log('📝 Saved task result:', { taskId, resultType: typeof task.result, resultLength: task.result?.length || 0 });
            }
            if (error) {
              task.result = { error };
            }
            if (status === 'completed' || status === 'failed') {
              task.endTime = Date.now();
            }
            // Update session last activity
            session.lastActivity = Date.now();
            // --- FIX: Remove undefined deadline before saving to Firestore ---
            if (session.task && session.task.deadline === undefined) {
              delete session.task.deadline;
            }
            // --- END FIX ---
            // If all tasks are completed, log the final answer
            const allCompleted = session.task.decomposition.subTasks.every((t: SubTask) => t.status === 'completed');
            if (allCompleted) {
              const lastCompleted = [...session.task.decomposition.subTasks].reverse().find((t: SubTask) => t.result && t.status === 'completed');
              let displayResult = lastCompleted?.result;
              if (typeof displayResult === 'string') {
                try {
                  const parsed = JSON.parse(displayResult);
                  if (parsed.agentResponse) displayResult = parsed.agentResponse;
                } catch (e) {}
              }
              console.log('🎯 FINAL ANSWER (full):', displayResult);
            }
            // Save the full updated session (not just status)
            const { firestoreSwarmStorage } = await import('./FirestoreSwarmStorage');
            await firestoreSwarmStorage.saveSession(session);
            console.log('✅ Task status updated in session:', {
              sessionId,
              taskId,
              status,
              hasResult: !!task.result,
              hasError: !!error,
              resultPreview: task.result ? (typeof task.result === 'string' ? task.result.substring(0, 50) + '...' : 'object') : 'none'
            });
          } else {
            console.warn('⚠️ Task not found in session:', taskId);
          }
        } else {
          console.warn('⚠️ Session or tasks not found:', sessionId);
        }
      } else {
        console.warn('⚠️ SwarmOrchestrator not available for status updates');
      }
    } catch (error) {
      console.error('❌ Failed to update task status:', error);
    }
  }

  /**
   * Get execution status for a session
   */
  getSessionExecutionStatus(sessionId: string): {
    totalTasks: number;
    queuedTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    overallProgress: number;
  } {
    const sessionQueue = this.executionQueue.get(sessionId) || [];
    
    const totalTasks = sessionQueue.length;
    const queuedTasks = sessionQueue.filter(e => e.status === 'queued').length;
    const runningTasks = sessionQueue.filter(e => e.status === 'running').length;
    const completedTasks = sessionQueue.filter(e => e.status === 'completed').length;
    const failedTasks = sessionQueue.filter(e => e.status === 'failed').length;
    
    const overallProgress = totalTasks > 0 
      ? Math.round(((completedTasks + failedTasks) / totalTasks) * 100)
      : 0;

    return {
      totalTasks,
      queuedTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      overallProgress
    };
  }

  /**
   * Stop execution for a session
   */
  stopSession(sessionId: string): void {
    console.log('🛑 Stopping task execution for session:', sessionId);
    
    // Remove from execution queue
    this.executionQueue.delete(sessionId);
    
    // Stop any running tasks for this session
    for (const [taskId, execution] of Array.from(this.runningTasks.entries())) {
      const sessionQueue = Array.from(this.executionQueue.values()).flat();
      const isSessionTask = sessionQueue.some(e => e.taskId === taskId);
      
      if (isSessionTask) {
        execution.status = 'failed';
        execution.error = 'Session stopped';
        this.runningTasks.delete(taskId);
      }
    }
  }

  async createTaskResult(
    execution: TaskExecution,
    content: any,
    confidence: number,
    type: 'intermediate' | 'final' | 'insight' | 'recommendation'
  ): Promise<SwarmResult> {
    const timestamp = new Date().toISOString();
    const resultId = `result-${execution.sessionId}-${execution.taskId}-${Date.now()}`;

    const result: SwarmResult = {
      contentType: 'swarm_result',
      contentId: resultId,
      userId: execution.sessionId.split('-')[0], // Extract user ID from session ID
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      status: 'active',
      
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,
      
      access: 'personal',
      sharedWith: [],
      
      primaryCategory: 'task_result',
      secondaryCategories: [],
      tags: ['swarm_result', type],
      
      title: `Task Result: ${execution.taskId}`,
      text: typeof content === 'string' ? content : JSON.stringify(content),
      summary: typeof content === 'string' ? content.substring(0, 200) : undefined,
      
      searchableText: typeof content === 'string' ? content : JSON.stringify(content),
      keywords: [],
      language: 'en',
      
      relatedIds: [execution.sessionId],
      references: [],
      
      swarm: {
        agentId: execution.agentId,
        taskId: execution.taskId,
        confidence,
        resultType: type,
        performanceMetrics: {
          processingTime: execution.endTime ? execution.endTime - (execution.startTime || 0) : 0,
          resourceUsage: 0,
          qualityScore: confidence
        }
      }
    };

    return result;
  }
}

// Export singleton instance
export const taskExecutionEngine = new TaskExecutionEngine(); 