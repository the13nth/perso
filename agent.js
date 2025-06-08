const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

class AgentFetcher {
  constructor() {
    this.retryCount = 0;
  }

  // Standardize agent ID by removing prefix if it exists
  standardizeAgentId(agentId) {
    return agentId.replace('agent_', '');
  }

  // Add prefix to agent ID if needed
  addAgentPrefix(agentId) {
    return agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
  }

  async fetchAgent(agentId) {
    try {
      // Standardize the ID first
      const standardId = this.standardizeAgentId(agentId);
      
      if (this.retryCount >= MAX_RETRIES) {
        throw new Error(`Failed to fetch agent after ${MAX_RETRIES} attempts`);
      }

      // Get agent config
      const config = await this.fetchAgentConfig(standardId);
      if (!config) {
        throw new Error('Failed to fetch agent configuration');
      }

      // Get agent questions
      const questions = await this.fetchAgentQuestions(standardId);
      
      // Combine the data
      return {
        ...config,
        questions,
        id: standardId
      };

    } catch (error) {
      this.retryCount++;
      console.error(`Attempt ${this.retryCount} failed:`, error.message);
      
      if (this.retryCount < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.fetchAgent(agentId);
      }
      
      throw error;
    }
  }

  async fetchAgentConfig(standardId) {
    try {
      const response = await fetch(`/api/agents/${standardId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agent config: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      throw new Error(`Error fetching agent config: ${error.message}`);
    }
  }

  async fetchAgentQuestions(standardId) {
    try {
      const response = await fetch(`/api/agents/${standardId}/questions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agent questions: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      throw new Error(`Error fetching agent questions: ${error.message}`);
    }
  }
}

// Export the fetcher
module.exports = new AgentFetcher(); 