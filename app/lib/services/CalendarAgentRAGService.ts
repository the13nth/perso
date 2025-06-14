import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '@clerk/nextjs/server';
import { Message } from 'ai';
import { BaseRAGService, RAGResponse } from './BaseRAGService';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

// Initialize the Google Gen AI client
const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

interface CalendarData {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  location?: string;
  description?: string;
  recurrence?: string[];
}

const CALENDAR_SYSTEM_PROMPT = `You are a calendar-focused AI agent designed to help users understand and analyze their calendar data and scheduling patterns.

ROLE AND EXPERTISE:
- Primary Focus: Calendar Analysis and Management
- Core Purpose: Help users understand their time allocation and optimize their scheduling

KEY CAPABILITIES:
1. Calendar Analysis
   - Identify scheduling patterns
   - Analyze meeting frequency and duration
   - Detect potential scheduling conflicts
   - Track recurring events and commitments

2. Time Management Analysis
   - Analyze time allocation across different types of events
   - Identify peak busy periods
   - Suggest optimal meeting times
   - Track work-life balance indicators

3. Meeting Pattern Analysis
   - Analyze attendee participation
   - Track most frequent collaborators
   - Identify common meeting times
   - Monitor meeting locations and formats

4. Summary Generation
   - Create schedule overviews
   - Summarize upcoming commitments
   - Highlight important events
   - Track deadline proximity

RESPONSE FORMAT:
1. Overview
   - Brief summary of calendar analysis
   - Number of events analyzed
   - Key patterns or urgent items

2. Important Events
   - List of upcoming critical events
   - Potential conflicts
   - Required preparations

3. Detailed Analysis
   - Time allocation breakdown
   - Meeting pattern insights
   - Scheduling recommendations

4. Recommendations
   - Schedule optimization suggestions
   - Meeting efficiency improvements
   - Time management tips

GUIDELINES:
1. Privacy & Security
   - Never share sensitive event details
   - Maintain confidentiality
   - Handle personal data with care

2. Clarity & Precision
   - Be clear and specific
   - Provide actionable insights
   - Use concrete examples

3. Context Awareness
   - Consider timezone differences
   - Note recurring patterns
   - Maintain schedule context

Current conversation history:
{chat_history}

Available calendar data:
{calendar_data}

User query: {query}

Response:`;

export class CalendarAgentRAGService implements BaseRAGService {
  private async fetchCalendarEvents(): Promise<CalendarData[]> {
    // Get auth session
    const session = await auth();
    if (!session || !session.userId) {
      throw new Error('User not authenticated');
    }

    // Get session token
    const token = await session.getToken();
    
    // Get base URL from environment or default
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Construct absolute URL
    const url = `${baseUrl}/api/integrations/calendar/debug`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch calendar events:', response.status, await response.text());
      throw new Error(`Failed to fetch calendar events: ${response.status}`);
    }

    const data = await response.json();
    return data.events;
  }

  private formatEventsForContext(events: CalendarData[]): string {
    // Group events by time period
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const groupedEvents = events.reduce((acc, event) => {
      const startDate = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
      
      let group = 'Future Events';
      if (startDate < today) {
        group = 'Past Events';
      } else if (startDate <= nextWeek) {
        group = 'Upcoming Week';
      }
      
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(event);
      return acc;
    }, {} as Record<string, CalendarData[]>);

    // Format events by group
    let formattedEvents = '';
    for (const [group, events] of Object.entries(groupedEvents)) {
      formattedEvents += `\n${group}:\n`;
      events.forEach(event => {
        const startTime = event.start.dateTime || event.start.date;
        const endTime = event.end.dateTime || event.end.date;
        const attendeeCount = event.attendees?.length || 0;
        
        formattedEvents += `
Event: ${event.summary}
Time: ${startTime} to ${endTime}
${event.location ? `Location: ${event.location}\n` : ''}${attendeeCount > 0 ? `Attendees: ${attendeeCount}\n` : ''}${event.recurrence ? 'Recurring: Yes\n' : ''}${event.description ? `Description: ${event.description}\n` : ''}
-------------------
`;
      });
    }

    return formattedEvents;
  }

  public async generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse> {
    try {
      // Fetch calendar events
      console.log(`Generating response for agent: ${agentId}`);
      console.log(`Message count: ${messages.length}`);
      
      const currentMessage = messages[messages.length - 1];
      console.log('User query:', currentMessage.content);

      const events = await this.fetchCalendarEvents();
      const formattedEvents = this.formatEventsForContext(events);

      // Format chat history
      const chatHistory = messages.slice(0, -1)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Generate response using the model
      const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
      const prompt = CALENDAR_SYSTEM_PROMPT
        .replace('{chat_history}', chatHistory)
        .replace('{calendar_data}', formattedEvents)
        .replace('{query}', currentMessage.content);

      const result = await model.generateContent([{ text: prompt }]);
      const responseText = result.response.text();
      
      return {
        success: true,
        response: responseText,
        agentId,
        contextUsed: events.length,
        relevanceScores: events.map(event => ({
          source: event.summary,
          score: 1.0,
          category: 'calendar'
        })),
        results: [],
  categoryContexts: []
      };
    } catch (_error) {
      console.error('Error generating response:', _error);
      return {
        success: false,
        response: "Failed to generate response",
        agentId,
        contextUsed: 0,
        relevanceScores: [],
        results: [],
        categoryContexts: []
      };
    }
  }
} 