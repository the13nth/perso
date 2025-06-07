import { GoogleGenAI } from '@google/genai';
import { 
  ComplexTask, 
  TaskDecomposition, 
  SubTask, 
  TaskDependency 
} from '@/types/swarm';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  apiVersion: 'v1'
});

export class TaskDecomposer {
  /**
   * Decompose a complex task into manageable subtasks
   */
  async decomposeTask(task: ComplexTask): Promise<TaskDecomposition> {
    console.log('🔍 Decomposing task:', task.description);

    try {
      const decompositionPrompt = this.createDecompositionPrompt(task);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: decompositionPrompt }] }],
        config: {
          maxOutputTokens: 2048,
          temperature: 0.3
        }
      });

      const decompositionText = response.text || '';
      const breakdown = this.parseDecompositionResponse(decompositionText, task);
      
      console.log('✅ Task decomposed into', breakdown.subTasks.length, 'subtasks');
      return breakdown;
    } catch (error) {
      console.error('❌ Task decomposition failed:', error);
      // Fallback to simple decomposition
      return this.createFallbackDecomposition(task);
    }
  }

  /**
   * Identify required capabilities for a task breakdown
   */
  async identifyRequiredCapabilities(breakdown: TaskDecomposition): Promise<string[]> {
    const capabilities = new Set<string>();

    // Extract capabilities from subtasks
    for (const subTask of breakdown.subTasks) {
      const taskCapabilities = await this.extractCapabilitiesFromTask(subTask.description);
      taskCapabilities.forEach(cap => capabilities.add(cap));
    }

    // Add general capabilities based on task description
    const desc = breakdown.subTasks[0]?.description.toLowerCase() || '';
    
    if (desc.includes('analysis')) {
      capabilities.add('data_analysis');
      capabilities.add('pattern_recognition');
    }
    
    if (desc.includes('research')) {
      capabilities.add('information_retrieval');
      capabilities.add('source_validation');
    }
    
    if (desc.includes('generate') || desc.includes('create')) {
      capabilities.add('content_generation');
      capabilities.add('creative_writing');
    }

    return Array.from(capabilities);
  }

  /**
   * Create decomposition prompt for AI
   */
  private createDecompositionPrompt(task: ComplexTask): string {
    return `Analyze this complex task and break it down into specific, actionable subtasks.

TASK TO DECOMPOSE:
Description: ${task.description}
Title: ${task.title}
Category: ${task.category}
Priority: ${task.priority}
Requirements: ${task.requirements.map(r => `${r.type}: ${r.value} (${r.importance})`).join(', ')}
${task.constraints ? `Constraints: ${task.constraints.join(', ')}` : ''}
${task.deadline ? `Deadline: ${new Date(task.deadline).toISOString()}` : ''}

INSTRUCTIONS:
1. Break the task into 3-7 specific subtasks
2. Each subtask should be:
   - Clearly defined and actionable
   - Achievable by a single agent
   - Estimated to take 5-30 minutes
3. Identify dependencies between subtasks
4. Estimate complexity (1-10 scale)
5. Determine if subtasks can be run in parallel

OUTPUT FORMAT (JSON):
{
  "mainTask": "Original task description",
  "subTasks": [
    {
      "id": "task_1",
      "description": "Specific actionable description",
      "dependencies": ["task_id_if_any"],
      "estimatedDuration": minutes_as_number,
      "status": "pending"
    }
  ],
  "dependencies": [
    {
      "fromTaskId": "task_1",
      "toTaskId": "task_2", 
      "type": "sequential|data_dependency|resource_dependency",
      "description": "Why this dependency exists"
    }
  ],
  "estimatedComplexity": number_1_to_10,
  "requiredCapabilities": ["capability1", "capability2"],
  "parallelizable": true_or_false,
  "criticalPath": ["task_1", "task_3", "task_5"]
}

Provide only the JSON response, no additional text.`;
  }

  /**
   * Parse AI response into TaskDecomposition structure
   */
  private parseDecompositionResponse(response: string, task: ComplexTask): TaskDecomposition {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Convert to our structure with proper IDs
      const subTasks: SubTask[] = parsed.subTasks.map((st: any) => ({
        id: st.id || uuidv4(),
        parentTaskId: task.id,
        description: st.description,
        status: 'pending' as const,
        assignedAgentId: undefined,
        startTime: undefined,
        endTime: undefined,
        result: undefined
      }));

      const dependencies: TaskDependency[] = (parsed.dependencies || []).map((dep: any) => ({
        fromTaskId: dep.fromTaskId,
        toTaskId: dep.toTaskId,
        type: dep.type || 'sequential',
        condition: dep.condition
      }));

      return {
        subTasks,
        dependencies,
        estimatedComplexity: parsed.estimatedComplexity || 5,
        requiredCapabilities: parsed.requiredCapabilities || []
      };
    } catch (error) {
      console.error('Failed to parse decomposition response:', error);
      return this.createFallbackDecomposition(task);
    }
  }

  /**
   * Create a simple fallback decomposition when AI fails
   */
  private createFallbackDecomposition(task: ComplexTask): TaskDecomposition {
    const taskId = uuidv4();
    const subTask: SubTask = {
      id: taskId,
      parentTaskId: task.id,
      description: task.description,
      status: 'pending',
      assignedAgentId: undefined,
      startTime: undefined,
      endTime: undefined,
      result: undefined
    };

    return {
      subTasks: [subTask],
      dependencies: [],
      estimatedComplexity: 5,
      requiredCapabilities: ['general_processing']
    };
  }

  /**
   * Extract capabilities from task description
   */
  private async extractCapabilitiesFromTask(taskDescription: string): Promise<string[]> {
    const capabilities: string[] = [];
    const desc = taskDescription.toLowerCase();

    // Pattern matching for common capabilities
    const capabilityPatterns = {
      'data_analysis': ['analyze', 'analysis', 'examine', 'study', 'investigate'],
      'content_generation': ['write', 'create', 'generate', 'compose', 'draft'],
      'research': ['research', 'find', 'search', 'lookup', 'investigate'],
      'summarization': ['summarize', 'summary', 'condense', 'brief'],
      'comparison': ['compare', 'contrast', 'evaluate', 'assess'],
      'calculation': ['calculate', 'compute', 'math', 'formula', 'equation'],
      'visualization': ['chart', 'graph', 'visualize', 'plot', 'diagram'],
      'translation': ['translate', 'convert', 'transform'],
      'classification': ['classify', 'categorize', 'organize', 'sort'],
      'validation': ['validate', 'verify', 'check', 'confirm']
    };

    for (const [capability, keywords] of Object.entries(capabilityPatterns)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        capabilities.push(capability);
      }
    }

    return capabilities.length > 0 ? capabilities : ['general_processing'];
  }

  /**
   * Validate task breakdown for consistency
   */
  validateBreakdown(breakdown: TaskDecomposition): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for circular dependencies
    if (this.hasCircularDependencies(breakdown)) {
      issues.push('Circular dependencies detected');
    }

    // Check if all dependency references are valid
    const taskIds = new Set(breakdown.subTasks.map(t => t.id));
    for (const dep of breakdown.dependencies) {
      if (!taskIds.has(dep.fromTaskId)) {
        issues.push(`Invalid dependency from task: ${dep.fromTaskId}`);
      }
      if (!taskIds.has(dep.toTaskId)) {
        issues.push(`Invalid dependency to task: ${dep.toTaskId}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Check for circular dependencies in task breakdown
   */
  private hasCircularDependencies(breakdown: TaskDecomposition): boolean {
    const graph = new Map<string, string[]>();
    
    // Build dependency graph
    for (const task of breakdown.subTasks) {
      graph.set(task.id, []);
    }
    
    for (const dep of breakdown.dependencies) {
      const dependencies = graph.get(dep.fromTaskId) || [];
      dependencies.push(dep.toTaskId);
      graph.set(dep.fromTaskId, dependencies);
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const taskId of Array.from(graph.keys())) {
      if (!visited.has(taskId)) {
        if (hasCycle(taskId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Optimize task order for parallel execution
   */
  optimizeTaskOrder(breakdown: TaskDecomposition): string[] {
    // Always try to find parallel execution opportunities
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();
    
    // Initialize
    for (const task of breakdown.subTasks) {
      inDegree.set(task.id, 0);
      graph.set(task.id, []);
    }

    // Build graph and calculate in-degrees
    for (const dep of breakdown.dependencies) {
      const successors = graph.get(dep.fromTaskId) || [];
      successors.push(dep.toTaskId);
      graph.set(dep.fromTaskId, successors);
      
      inDegree.set(dep.toTaskId, (inDegree.get(dep.toTaskId) || 0) + 1);
    }

    // Topological sort
    const queue: string[] = [];
    const result: string[] = [];

    // Add all nodes with in-degree 0
    for (const [taskId, degree] of Array.from(inDegree.entries())) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // Reduce in-degree of successors
      const successors = graph.get(current) || [];
      for (const successor of successors) {
        const newDegree = (inDegree.get(successor) || 0) - 1;
        inDegree.set(successor, newDegree);
        
        if (newDegree === 0) {
          queue.push(successor);
        }
      }
    }

    return result;
  }
} 