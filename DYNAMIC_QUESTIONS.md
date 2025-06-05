# Dynamic Question Generation

## Overview

This document describes the new dynamic question generation system that replaces static example questions with AI-powered, agent-specific questions tailored to each agent's capabilities and domain expertise.

## Problem Solved

Previously, all agents displayed the same generic example questions:
- "What is your main purpose?"
- "What specific tasks can you help with?"
- "Can you show me an example of your capabilities?"

These static questions didn't showcase the unique value or specific expertise of each agent, making it harder for users to understand what they could accomplish with specialized agents.

## Solution

A new **Dynamic Question Generation System** that:

1. **Generates Agent-Specific Questions** using LLM analysis of each agent's metadata
2. **Creates Actionable Scenarios** with concrete examples and realistic use cases
3. **Provides Refresh Capability** allowing users to generate new questions on demand
4. **Includes Intelligent Fallbacks** ensuring reliability even when AI generation fails

## How It Works

### 1. Question Generation Process

```
Agent Metadata → LLM Analysis → 3 Tailored Questions → UI Display → Refresh Option
```

### 2. API Endpoint

**`GET /api/agents/[agentId]/questions`**

- Analyzes agent's name, description, category, and use cases
- Uses Gemini with higher temperature (0.8) for creativity
- Returns 3 diverse question types:
  - **Analytical/Strategic**: Analysis, insights, recommendations
  - **Task-Oriented**: Specific tasks or processes
  - **Informational**: Best practices, trends, domain knowledge

### 3. Question Quality Guidelines

The LLM follows specific guidelines to ensure high-quality questions:

- **Highly specific** to the agent's expertise
- **Immediately actionable** with concrete scenarios
- **Conversational and engaging** (15-60 words)
- **Include domain terminology** and specific concepts
- **Avoid generic questions** like "What can you do?"

### 4. Example Transformations

| Agent Type | Generated Questions |
|---|---|
| **Financial Advisor** | "How should I structure my portfolio for a recession while maintaining 7% annual returns?" |
| **Fitness Trainer** | "Create a 6-week strength training plan for someone recovering from a knee injury" |
| **Marketing Expert** | "What's the best social media strategy for a B2B SaaS startup with a $5K monthly budget?" |

## UI Features

### 1. Loading States
- **Skeleton Loading**: Animated placeholders while questions generate
- **Refresh Loading**: Spinner animation during question regeneration

### 2. Interactive Elements
- **Clickable Questions**: Each question can be clicked to start a conversation
- **Refresh Button**: "New Questions" button with loading state
- **Hover Effects**: Subtle scale animation on question cards

### 3. Error Handling
- **Toast Notifications**: Success/error feedback for users
- **Graceful Fallbacks**: Default questions if AI generation fails
- **Retry Mechanism**: Users can refresh to try generating again

## Technical Implementation

### 1. Frontend Component (`ExampleQuestions`)

```typescript
// State management for questions and loading
const [questions, setQuestions] = useState<string[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

// Dynamic question generation
const generateQuestions = async (showRefreshLoader = false) => {
  // Fetch from API and update state
};
```

### 2. Backend API (`/api/agents/[agentId]/questions/route.ts`)

```typescript
// LLM prompt engineering for quality questions
const QUESTION_GENERATION_TEMPLATE = `...`;

// JSON parsing with fallback handling
const questionsData = JSON.parse(jsonMatch[0]);
```

### 3. Enhanced User Experience

- **Auto-generation**: Questions load automatically when agent page opens
- **Caching**: Questions persist during the session (regenerated on refresh)
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Benefits

1. **Improved Discovery**: Users instantly understand agent capabilities
2. **Better Engagement**: Specific questions encourage deeper interactions
3. **Reduced Friction**: Clear starting points for conversations
4. **Showcase Expertise**: Demonstrates the agent's specialized knowledge
5. **Dynamic Content**: Fresh questions keep the experience interesting

## Configuration

- **Model**: Gemini 2.0 Flash for question generation
- **Temperature**: 0.8 (for creative, diverse questions)
- **Max Tokens**: 1024 (sufficient for detailed questions)
- **Fallback Strategy**: Agent-specific default questions based on metadata

## Error Handling

1. **API Failures**: Falls back to metadata-based questions
2. **JSON Parsing Errors**: Provides structured fallback questions
3. **Network Issues**: Shows retry option with user feedback
4. **Agent Not Found**: Returns appropriate error message

## Future Enhancements

- **Question Analytics**: Track which questions lead to successful conversations
- **User Preferences**: Learn from user interactions to improve question quality
- **Multi-language Support**: Generate questions in user's preferred language
- **Question Categories**: Allow users to request specific types of questions
- **A/B Testing**: Compare different question generation strategies 