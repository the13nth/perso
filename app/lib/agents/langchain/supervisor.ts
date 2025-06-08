
import type { SuperAgentConfig, AgentCapability, ProcessingStep, Context, AgentMetadata } from "./types";
import { getAgentContext } from "@/app/lib/pinecone";
import { GoogleGenerativeAI } from '@google/generative-ai';







export class AgentSupervisor {
  private agentId: string;
  private metadata: AgentMetadata;
  private capabilities: AgentCapability[];
  private model: GoogleGenerativeAI;
  private superAgent: SuperAgentConfig | null = null;

  constructor(config: {
    agentId: string;
    metadata: AgentMetadata;
    capabilities: AgentCapability[];
    tools: string[];
  }) {
    this.agentId = config.agentId;
    this.metadata = config.metadata;
    this.capabilities = config.capabilities;
    this.model = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
  }


  async processMessage(content: string, showSteps: boolean = false): Promise<{ response: string; steps?: ProcessingStep[] }> {
    const steps: ProcessingStep[] = [];
    const startTime = Date.now();

    try {
      // Step 1: Query Analysis
      steps.push({
        id: 'query',
        label: 'Query Analysis',
        type: 'input',
        status: 'running',
        details: 'Analyzing user query',
        timestamp: startTime,
        metadata: {
          agentId: this.superAgent!.agentId,
          capability: 'query_analysis'
        }
      });

      // Step 2: Context Retrieval
      steps.push({
        id: 'context',
        label: 'Context Retrieval',
        type: 'process',
        status: 'running',
        details: 'Retrieving relevant context',
        timestamp: startTime + 1000,
        metadata: {
          agentId: this.superAgent!.agentId,
          capability: 'context_retrieval'
        }
      });

      const context = await this.getAgentContext(content);
      steps[1].status = 'completed';
      steps[1].details = `Retrieved ${context.length} relevant context items`;

      // Step 3: Capability Selection
      steps.push({
        id: 'capability',
        label: 'Capability Selection',
        type: 'process',
        status: 'running',
        details: 'Selecting appropriate capabilities',
        timestamp: startTime + 2000,
        metadata: {
          agentId: this.superAgent!.agentId,
          capability: 'capability_selection'
        }
      });

      const selectedCapabilities = this.selectCapabilities(content);
      steps[2].status = 'completed';
      steps[2].details = `Selected capabilities: ${selectedCapabilities.map(c => c.name).join(', ')}`;

      // Step 4: Task Execution
      steps.push({
        id: 'execution',
        label: 'Task Execution',
        type: 'process',
        status: 'running',
        details: 'Executing task with selected capabilities',
        timestamp: startTime + 3000,
        metadata: {
          agentId: this.superAgent!.agentId,
          capability: 'task_execution'
        }
      });

      // Analyze available data
      const availableData = this.analyzeAvailableData(context.map(c => c.pageContent));
      const dataInsight = this.generateDataInsight(availableData);

      let response: string;
      if (availableData.hasData) {
        // Execute with available data
        const result = await this.executeTask(content, selectedCapabilities, context);
        steps[3].status = 'completed';
        steps[3].details = 'Task executed successfully with available data';
        response = result;
      } else if (availableData.hasPartialData) {
        // Execute with partial data
        const result = await this.executeTask(content, selectedCapabilities, context);
        steps[3].status = 'completed';
        steps[3].details = 'Task executed with partial data';
        response = `Based on the partial data available:\n\n${result}\n\n${dataInsight}`;
      } else {
        // No usable data
        steps[3].status = 'completed';
        steps[3].details = 'No relevant data available';
        response = `I cannot provide a complete answer as I don't have access to the necessary data. ${dataInsight}`;
      }

      // Step 5: Response Generation
      steps.push({
        id: 'response',
        label: 'Response Generation',
        type: 'output',
        status: 'completed',
        details: 'Response generated successfully',
        timestamp: startTime + 4000,
        metadata: {
          agentId: this.superAgent!.agentId,
          capability: 'response_generation'
        }
      });

      return {
        response,
        steps: showSteps ? steps : undefined
      };
    } catch (error) {
      const failedStep = steps.find(s => s.status === 'running');
      if (failedStep) {
        failedStep.status = 'error';
        failedStep.details = error instanceof Error ? error.message : 'An unknown error occurred';
      }
      throw error;
    }
  }

  private analyzeAvailableData(context: string[]): { 
    hasData: boolean; 
    hasPartialData: boolean;
    availableFields: string[];
    missingFields: string[];
    dataQuality: 'full' | 'partial' | 'none';
  } {
    // Check for common data patterns
    const hasRunningData = context.some(c => 
      c.includes('distance') || 
      c.includes('duration') || 
      c.includes('pace') ||
      c.includes('km') ||
      c.includes('miles')
    );



    const availableFields = [];
    const missingFields = [];

    // Check specific fields
    if (context.some(c => c.includes('distance'))) availableFields.push('distance');
    else missingFields.push('distance');

    if (context.some(c => c.includes('duration'))) availableFields.push('duration');
    else missingFields.push('duration');

    if (context.some(c => c.includes('location'))) availableFields.push('location');
    else missingFields.push('location');

    if (context.some(c => c.includes('energy'))) availableFields.push('energy level');
    else missingFields.push('energy level');

    // Determine data completeness
    const hasData = hasRunningData && availableFields.length >= 2;
    const hasPartialData = hasRunningData || availableFields.length > 0;
    const dataQuality = hasData ? 'full' : (hasPartialData ? 'partial' : 'none');

    return {
      hasData,
      hasPartialData,
      availableFields,
      missingFields,
      dataQuality
    };
  }

  private generateDataInsight(analysis: ReturnType<typeof this.analyzeAvailableData>): string {
    if (analysis.dataQuality === 'full') {
      return `I'm working with a complete dataset that includes: ${analysis.availableFields.join(', ')}.`;
    } else if (analysis.dataQuality === 'partial') {
      return `I'm working with partial data that includes: ${analysis.availableFields.join(', ')}. For more comprehensive analysis, consider adding data about: ${analysis.missingFields.join(', ')}.`;
    } else {
      return `To help you better, please provide some running data that includes: ${analysis.missingFields.slice(0, 3).join(', ')}.`;
    }
  }


  private selectCapabilities(_query: string): AgentCapability[] {
    // For now, return all capabilities
    // TODO: Implement capability selection based on query
    return this.capabilities;
  }

  private async executeTask(
    query: string, 
    _capabilities: AgentCapability[], 
    context: Context[]
  ): Promise<string> {
    // Extract text content from contexts
    const contextTexts = context.map(c => c.pageContent);
    
    // Analyze available data
    const dataAnalysis = this.analyzeAvailableData(contextTexts);
    
    // Build prompt based on available data
    let prompt = `You are a specialized AI assistant focusing on ${this.metadata.category}.\n`;
    prompt += `Your task is to ${this.metadata.description}\n\n`;
    
    if (dataAnalysis.hasData || dataAnalysis.hasPartialData) {
      prompt += `Available data includes: ${dataAnalysis.availableFields.join(', ')}\n`;
      prompt += `Context information:\n${contextTexts.join('\n')}\n\n`;
    }
    
    prompt += `User query: ${query}\n\n`;
    prompt += `Please provide a detailed response based on the available data. If using partial data, be clear about any limitations in your analysis.`;

    try {
      // Use model to generate response
      const gemini = this.model.getGenerativeModel({ model: 'gemini-pro' });
      const result = await gemini.generateContent(prompt);
      return result.response.text() || 'Failed to generate response';
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Failed to generate response due to an error';
    }
  }

  private async getAgentContext(query: string): Promise<Context[]> {
    // Get context from Pinecone
    const contextDocs = await getAgentContext(this.agentId, query);
    return contextDocs.map(doc => ({
      pageContent: doc.pageContent || '',
      metadata: {
        source: doc.metadata?.source || '',
        score: doc.metadata?.score || 0,
        title: doc.metadata?.title || ''
      }
    }));
  }
} 