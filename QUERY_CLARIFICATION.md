# Query Clarification Layer

## Overview

This document describes the new query clarification layer that has been added to the retrieval system to improve the accuracy of document searches and AI responses.

## Problem Solved

Previously, when users submitted queries that were:
- Vague or ambiguous
- Using implicit references ("that document", "the thing we discussed")
- Missing context from the conversation history
- Using abbreviations or unclear terms

The system would directly search the embeddings with these unclear queries, often resulting in poor document retrieval and inadequate AI responses.

## Solution

A new **Query Clarification Layer** has been implemented that:

1. **Analyzes user queries** using an LLM before searching embeddings
2. **Makes implicit references explicit** by adding context from chat history
3. **Expands abbreviations** and unclear terms
4. **Provides fallback** to the original query if clarification doesn't improve results

## How It Works

### 1. Query Processing Flow

```
User Query → LLM Clarification → Embedding Search → Context Retrieval → AI Response
```

### 2. Implementation Details

The clarification happens in these steps:

1. **Input**: Original user query + chat history
2. **LLM Analysis**: Uses Gemini model with temperature 0.3 for consistent results
3. **Output**: Clarified, standalone search query
4. **Fallback**: If no results found with clarified query, tries original query

### 3. Enhanced Components

The following components now include query clarification:

- **`/api/chat/retrieval`** - Main retrieval endpoint
- **`/api/chat/retrieval_agents`** - Agents-based retrieval
- **`AgentRAGService`** - Service layer for agent interactions

## Example Transformations

| Original Query | Clarified Query |
|---|---|
| "Show me that running data" | "Show me the running activity data from previous uploads" |
| "What did we discuss about training?" | "What training recommendations and advice were discussed in our conversation?" |
| "More details on that PDF" | "More details on the PDF document about [specific topic mentioned earlier]" |

## Benefits

1. **Improved Accuracy**: Better document matching through clearer queries
2. **Context Awareness**: Leverages conversation history for better understanding
3. **Robust Fallback**: Original query used if clarification doesn't help
4. **Performance**: Low latency with caching and efficient LLM calls

## Configuration

- **Model**: Gemini 2.0 Flash for clarification
- **Temperature**: 0.3 (for consistent, focused clarifications)
- **Max Tokens**: 512 (sufficient for query clarification)
- **Fallback**: Automatic if clarified query returns no results

## Future Enhancements

- Query intent classification
- User feedback integration for clarification quality
- Multi-language query clarification
- Query expansion based on user's domain expertise 