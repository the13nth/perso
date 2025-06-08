const agentFetcher = require('./agent');

async function main() {
  try {
    // Example agent ID - can be with or without prefix
    const agentId = 'ecc6f68a-2a9f-494d-aca1-5eb6c05487a7';
    
    console.log('Fetching agent...');
    const agent = await agentFetcher.fetchAgent(agentId);
    
    console.log('Agent fetched successfully:', {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      questionsCount: agent.questions?.length || 0
    });
    
  } catch (error) {
    console.error('Failed to fetch agent:', error.message);
    process.exit(1);
  }
}

main(); 