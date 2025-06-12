import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/pinecone';
import { AgentRAGService } from '@/app/lib/services/AgentRAGService';
import { EmailAgentRAGService } from '@/app/lib/services/EmailAgentRAGService';
import { CalendarAgentRAGService } from '@/app/lib/services/CalendarAgentRAGService';
import { BaseRAGService } from '@/app/lib/services/BaseRAGService';

// Initialize services
const ragService: BaseRAGService = new AgentRAGService();
const emailAgentService: BaseRAGService = new EmailAgentRAGService();
const calendarAgentService: BaseRAGService = new CalendarAgentRAGService();

export const runtime = "edge";

interface FormattedResponse {
  type: string;
  content: string | string[] | Record<string, unknown> | Array<{
    label: string;
    value: string;
  }> | Array<{
    date: string;
    details: string;
  }>;
}

function formatResponse(text: string): FormattedResponse[] {
  const formattedSections: FormattedResponse[] = [];

  // Try to parse the response into structured data
  if (text.includes('Account Overview:')) {
    // Extract account details
    const accountMatch = text.match(/Account Number: (.*?)\n.*?Account Type: (.*?)\n.*?Currency: (.*?)\n.*?Opening Balance[^:]*: (.*?)(?:\n|$)/);
    if (accountMatch) {
      formattedSections.push({
        type: 'accountOverview',
        content: [
          { label: 'Account Number', value: accountMatch[1].trim() },
          { label: 'Account Type', value: accountMatch[2].trim() },
          { label: 'Currency', value: accountMatch[3].trim() },
          { label: 'Opening Balance', value: accountMatch[4].trim() }
        ]
      });
    }
  }

  // Extract transactions
  const transactionsMatch = text.match(/Recent Transactions[^:]*:([\s\S]*?)(?:\n\n|$)/);
  if (transactionsMatch) {
    const transactions = transactionsMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('*'))
      .map(line => {
        const [date, ...rest] = line.replace('* ', '').split(': ');
        return {
          date: date.trim(),
          details: rest.join(': ').trim()
        };
      });
    
    if (transactions.length > 0) {
      formattedSections.push({
        type: 'transactions',
        content: transactions
      });
    }
  }

  // Extract spending habits
  const spendingMatch = text.match(/Spending Habits:([\s\S]*?)(?:\n\n|$)/);
  if (spendingMatch) {
    formattedSections.push({
      type: 'spendingHabits',
      content: spendingMatch[1].trim()
    });
  }

  // Extract additional information
  const additionalMatch = text.match(/Additional Information:([\s\S]*?)(?:\n\n|$)/);
  if (additionalMatch) {
    formattedSections.push({
      type: 'additionalInfo',
      content: additionalMatch[1].trim()
    });
  }

  // Extract recommendations
  const recommendationsMatch = text.match(/Recommendations:\n([\s\S]*?)(?:\n\n|$)/);
  if (recommendationsMatch) {
    const recommendations = recommendationsMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('*'))
      .map(line => line.replace('* ', '').trim());
    
    if (recommendations.length > 0) {
      formattedSections.push({
        type: 'recommendations',
        content: recommendations
      });
    }
  }

  // Extract disclaimer
  const disclaimerMatch = text.match(/Disclaimer:([\s\S]*?)(?:\n\n|$)/);
  if (disclaimerMatch) {
    formattedSections.push({
      type: 'disclaimer',
      content: disclaimerMatch[1].trim()
    });
  }

  // If no sections were created, add the entire text as a single section
  if (formattedSections.length === 0) {
    formattedSections.push({
      type: 'text',
      content: text.trim()
    });
  }

  return formattedSections;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: "Agent ID is required and must be a string" },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await request.json();
    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Messages array is required in request body" },
        { status: 400 }
      );
    }

    // Get agent configuration
    const agentConfig = await getAgentConfig(agentId);
    
    // Choose the appropriate service based on agent type and primary context
    let service: BaseRAGService = ragService;

    // Only use specialized services if they are the PRIMARY context
    const primaryContext = agentConfig.primaryCategory || agentConfig.selectedContextIds?.[0];
    if (primaryContext === 'Emails') {
      service = emailAgentService;
      console.log('Using EmailAgentRAGService for primary email context');
    } else if (primaryContext === 'Calendar') {
      service = calendarAgentService;
      console.log('Using CalendarAgentRAGService for primary calendar context');
    } else {
      console.log('Using standard RAGService for multi-context agent');
    }

    // Generate response using the selected service
    const response = await service.generateResponse(agentId, body.messages);

    // Format the response into UI sections
    const formattedContent = formatResponse(response.response);

    // Add category contexts to response headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    
    if (response.categoryContexts) {
      headers.set(
        'x-category-contexts',
        Buffer.from(JSON.stringify(response.categoryContexts)).toString('base64')
      );
    }

    // Return JSON response with formatted content and category contexts
    return new NextResponse(JSON.stringify({
      ...response,
      formattedContent,
    }), {
      status: 200,
      headers
    });
  } catch (error: Error | unknown) {
    console.error('Error in agent chat:', error);
    
    let errorMessage = 'Failed to process chat request';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message?.includes('API key')) {
        errorMessage = 'Invalid or missing API key';
        statusCode = 401;
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Agent not found';
        statusCode = 404;
      }
    }
    
    return new NextResponse(JSON.stringify({
      error: errorMessage,
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 