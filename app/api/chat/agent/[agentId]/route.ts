import { NextRequest, NextResponse } from 'next/server';
import { AgentRAGService } from '../../../../lib/services/AgentRAGService';

const ragService = new AgentRAGService();

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

    // Generate response using the RAG service
    const response = await ragService.generateResponse(agentId, body.messages);

    // Format the response into UI sections
    const formattedContent = formatResponse(response.response);

    // Return JSON response with formatted content
    return new NextResponse(JSON.stringify({
      ...response,
      formattedContent,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: Error | unknown) {
    console.error('Error in chat route:', error);
    
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