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

// Remove edge runtime since we need Node.js features
// export const runtime = "edge";

// Response formatting types
interface FormattedSection {
  type: string;
  content: string | string[] | Record<string, unknown> | Record<string, unknown>[];
}

function formatResponse(response: string): FormattedSection[] {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    
    const sections: FormattedSection[] = [];

    // Add main response
    if (parsed.response) {
      sections.push({
        type: 'text',
        content: parsed.response
      });
    }

    // Add insights if available
    if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
      sections.push({
        type: 'insights',
        content: parsed.insights
      });
    }

    // Add metadata if available
    if (parsed.metadata) {
      sections.push({
        type: 'metadata',
        content: parsed.metadata
      });
    }

    return sections;
  } catch (error) {
    // If parsing fails, return as plain text
    return [{
      type: 'text',
      content: response
    }];
  }
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
    // Append closest document matches for transparency if they exist
    if (response.closestMatches && response.closestMatches.length > 0) {
      formattedContent.push({
        type: 'references',
        content: response.closestMatches
      });
    }

    // Add category contexts to response headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    
    if (response.categoryContexts) {
      headers.set(
        'x-category-contexts',
        Buffer.from(JSON.stringify(response.categoryContexts)).toString('base64')
      );
    }

    return NextResponse.json({
      ...response,
      formattedContent
    }, { headers });

  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 