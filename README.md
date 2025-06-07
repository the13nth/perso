# 🦜️🔗 LangChain + Next.js Starter Template

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/langchain-ai/langchain-nextjs-template)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flangchain-ai%2Flangchain-nextjs-template)

This template scaffolds a LangChain.js + Next.js starter app with an integrated content ingestion system. It showcases how to use and combine LangChain modules for several use cases:

- [Simple chat](/app/api/chat/route.ts)
- [Returning structured output from an LLM call](/app/api/chat/structured_output/route.ts)
- [Answering complex, multi-step questions with agents](/app/api/chat/agents/route.ts)
- [Retrieval augmented generation (RAG) with a chain and a vector store](/app/api/chat/retrieval/route.ts)
- [Retrieval augmented generation (RAG) with an agent and a vector store](/app/api/chat/retrieval_agents/route.ts)

Most of them use Vercel's [AI SDK](https://github.com/vercel-labs/ai) to stream tokens to the client and display the incoming messages.

The agents use [LangGraph.js](https://langchain-ai.github.io/langgraphjs/), LangChain's framework for building agentic workflows. They use preconfigured helper functions to minimize boilerplate, but you can replace them with custom graphs as desired.

It's free-tier friendly too! Check out the [bundle size stats below](#-bundle-size).

You can check out a hosted version of this repo here: https://langchain-nextjs-template.vercel.app/

## 🔄 Content Ingestion System

The application features a unified content ingestion system that handles multiple content types:

### 📄 Documents
- 800-token chunks with 150 token overlap
- Automatic metadata extraction
- File information tracking
- Page counting and complexity assessment

### 📝 Notes
- 1000-token chunks with markdown support
- Checkbox and code block detection
- Rich metadata including tags and formatting
- Pinned/starred status tracking

### 🎯 Activities
Comprehensive activity tracking across four categories:

#### Physical Activities
- Exercise, sports, and physical activities
- Duration, distance, and intensity tracking
- Location and goal tracking
- Performance metrics

#### Work Activities
- Project-based task tracking
- Collaboration tracking
- Tool and technology logging
- Productivity metrics

#### Study Activities
- Subject and material tracking
- Comprehension assessment
- Learning progress monitoring
- Resource management

#### Routine Activities
- Daily habit tracking
- Mood tracking (before/after)
- Consistency assessment
- Pattern analysis

### 🔍 Key Features
- Unified vector storage with Pinecone
- Consistent metadata structure
- Rich search capabilities
- Relationship tracking
- Reference handling
- Batch processing
- Type-specific metadata extraction

### 🏗️ Core Components
- Base interfaces for content types
- Specialized ingestion handlers
- Unified content processor
- Utility functions for text processing
- Content analysis tools

## 🚀 Getting Started

First, clone this repo and download it locally.

Next, you'll need to set up environment variables in your repo's `.env.local` file. Copy the `.env.example` file to `.env.local`.
To start with the basic examples, you'll need to add:

- Your OpenAI API key
- Google AI API key (for embeddings and content analysis)
- Pinecone API key and index name (for vector storage)

Because this app is made to run in serverless Edge functions, make sure you've set the `LANGCHAIN_CALLBACKS_BACKGROUND` environment variable to `false` to ensure tracing finishes if you are using [LangSmith tracing](https://docs.smith.langchain.com/).

Next, install the required packages using yarn:

```bash
yarn
```

Now you're ready to run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result! Ask the bot something and you'll see a streamed response:

![A streaming conversation between the user and the AI](/public/images/chat-conversation.png)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Backend logic lives in `app/api/chat/route.ts`. From here, you can change the prompt and model, or add other modules and logic.

## ⚠️ Important Configuration Note

This project uses ES Modules (`"type": "module"` in package.json). If you're experiencing the following error:

```
ReferenceError: module is not defined in ES module scope
```

Make sure to:

1. Rename any CommonJS files (like `postcss.config.js`) to use the `.cjs` extension:
   ```bash
   mv postcss.config.js postcss.config.cjs
   ```

2. In `tsconfig.json`, ensure the module resolution is set correctly:
   ```json
   "module": "esnext",
   "moduleResolution": "bundler",
   ```

3. Update `next.config.js` to use current Next.js configurations:
   ```js
   const nextConfig = {
     experimental: {},
     serverExternalPackages: ['styled-jsx'], // Updated from serverComponentsExternalPackages
     output: 'standalone',
     distDir: '.next',
     images: {
       domains: [],
     },
   };
   ```

## 🧱 Structured Output

The second example shows how to have a model return output according to a specific schema using OpenAI Functions.
Click the `Structured Output` link in the navbar to try it out:

![A streaming conversation between the user and an AI agent](/public/images/structured-output-conversation.png)

The chain in this example uses a [popular library called Zod](https://zod.dev) to construct a schema, then formats it in the way OpenAI expects.
It then passes that schema as a function into OpenAI and passes a `function_call` parameter to force OpenAI to return arguments in the specified format.

For more details, [check out this documentation page](https://js.langchain.com/docs/how_to/structured_output).

## 🦜 Agents

To try out the agent example, you'll need to give the agent access to the internet by populating the `SERPAPI_API_KEY` in `.env.local`.
Head over to [the SERP API website](https://serpapi.com/) and get an API key if you don't already have one.

You can then click the `Agent` example and try asking it more complex questions:

![A streaming conversation between the user and an AI agent](/public/images/agent-conversation.png)

This example uses a [prebuilt LangGraph agent](https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/), but you can customize your own as well.

## 🐶 Retrieval

The retrieval examples use Pinecone as a vector store. You can swap in
[another supported vector store](https://js.langchain.com/docs/integrations/vectorstores) if preferred by changing
the code under `app/api/retrieval/ingest/route.ts`, `app/api/chat/retrieval/route.ts`, and `app/api/chat/retrieval_agents/route.ts`.

For Pinecone, sign up for a free account at [pinecone.io](https://www.pinecone.io/) and create an index with dimensions that match your embeddings model. Set the `PINECONE_API_KEY` and `PINECONE_INDEX` environment variables in your `.env.local` file.

You can then switch to the `Retrieval` and `Retrieval Agent` examples. The default document text is pulled from the LangChain.js retrieval
use case docs, but you can change them to whatever text you'd like.

For a given text, you'll only need to press `Upload` once. Pressing it again will re-ingest the docs, resulting in duplicates.

After splitting, embedding, and uploading some text, you're ready to ask questions!

For more info on retrieval chains, [see this page](https://js.langchain.com/docs/tutorials/rag).
The specific variant of the conversational retrieval chain used here is composed using LangChain Expression Language, which you can
[read more about here](https://js.langchain.com/docs/how_to/qa_sources/). This chain example will also return cited sources
via header in addition to the streaming response.

For more info on retrieval agents, [see this page](https://langchain-ai.github.io/langgraphjs/tutorials/rag/langgraph_agentic_rag/).

## ⚠️ Document Size Limitations

To ensure optimal performance and avoid timeout issues on serverless platforms, the application enforces different document size limits based on your plan and deployment environment:

### 🆓 Free Tier (Online Deployments)
- **Maximum document size**: 1MB per document
- **Reason**: Balanced performance for free tier users
- **Upgrade option**: Pro plan offers unlimited document processing
- **Alternatives**: Split documents into smaller parts or use the application locally

### 💎 Pro Plan (Online Deployments)
- **Maximum document size**: Unlimited
- **Advanced processing**: Handle large documents with extended timeout limits
- **Priority support**: Faster processing and dedicated resources
- **Background processing**: Large documents processed asynchronously

### 💻 Local Development
- **Maximum document size**: No limit
- **Large document handling**: Documents over 50KB are processed asynchronously
- **No timeout restrictions**: Full processing capabilities available

### 📝 How to Handle Large Documents

**For Free Tier Users:**
1. **Upgrade to Pro**: Get unlimited document processing with our Pro plan
2. **Split documents**: Break large documents into logical sections (chapters, topics, etc.)
3. **Use summaries**: Create condensed versions of lengthy documents
4. **Process locally**: Use local development for initial processing, then deploy smaller chunks

**For Pro Plan Users:**
1. Upload documents of any size directly
2. Large documents are automatically processed in the background
3. Receive notifications when processing is complete

**For Local Development:**
1. Documents up to 50KB are processed immediately
2. Larger documents are processed in the background with progress tracking
3. You'll receive notifications when processing is complete

The application will automatically detect your environment and plan, applying the appropriate limits and providing clear feedback when documents exceed the allowed size.

## 📊 Comprehensive Activity Logging

This application includes a powerful activity logging system that goes beyond simple physical activity tracking. It supports comprehensive activity logging across four main categories:

### 🏃‍♂️ Physical Activities
Track your exercise, sports, and physical activities with detailed metrics:
- **Activity Types**: Running, cycling, swimming, weightlifting, yoga, team sports, and more
- **Metrics**: Duration, distance, intensity level, location
- **Tracking**: Goals, achievement levels, physical sensations
- **Features**: Distance tracking with multiple units, intensity levels from light to maximum

### 💼 Work Activities
Log your professional tasks and projects with work-specific details:
- **Activity Types**: Coding, meetings, planning, design, research, documentation, debugging
- **Metrics**: Project names, collaborators, tools used, focus levels
- **Tracking**: Tasks completed, productivity levels, work goals
- **Features**: Multi-hour duration support, collaboration tracking, tool/technology logging

### 📚 Study Activities
Track your learning and educational activities with academic metrics:
- **Activity Types**: Reading, online courses, lectures, practice, research, note-taking
- **Metrics**: Subjects, study materials, comprehension levels
- **Tracking**: Notes created, learning goals, understanding levels
- **Features**: Subject categorization, material tracking, comprehension assessment

### 🔄 Routine Activities
Monitor your daily routines and habits with consistency tracking:
- **Activity Types**: Morning/evening routines, meditation, meal prep, cleaning, relaxation
- **Metrics**: Routine steps, consistency levels, mood before/after
- **Tracking**: Habit formation, mood changes, routine adherence
- **Features**: Mood tracking, consistency assessment, routine step documentation

### 🔧 Key Features

#### Comprehensive Tracking
- **Multi-Category Support**: Physical, work, study, and routine activities in one unified system
- **Rich Metadata**: Each activity type has specific fields relevant to that category
- **Goal Tracking**: Set and track achievement of specific goals for any activity
- **Productivity Metrics**: Track productivity levels and feelings across all activity types

#### Smart Organization
- **Automatic Categorization**: Activities are automatically categorized and tagged for easy searching
- **Searchable History**: All activities are stored with embeddings for semantic search
- **Visual Analytics**: 3D visualization of activity patterns and categories
- **Contextual Insights**: AI-powered insights based on your activity patterns

#### Usage
1. Navigate to the **Retrieval** page
2. Click **Log Activity** 
3. Select your activity category (Physical, Work, Study, or Routine)
4. Choose the specific activity type
5. Fill in relevant details and metrics
6. Save to add to your personal knowledge base

The system automatically generates embeddings for each activity, making them searchable and enabling AI-powered insights about your patterns, productivity, and progress across all areas of life.

## 📦 Bundle size

The bundle size for LangChain itself is quite small. After compression and chunk splitting, for the RAG use case LangChain uses 37.32 KB of code space (as of [@langchain/core 0.1.15](https://npmjs.com/package/@langchain/core)), which is less than 4% of the total Vercel free tier edge function alottment of 1 MB:

![](/public/images/bundle-size.png)

This package has [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) set up by default - you can explore the bundle size interactively by running:

```bash
$ ANALYZE=true yarn build
```

## 📚 Learn More

The example chains in the `app/api/chat/route.ts` and `app/api/chat/retrieval/route.ts` files use
[LangChain Expression Language](https://js.langchain.com/docs/concepts#langchain-expression-language) to
compose different LangChain.js modules together. You can integrate other retrievers, agents, preconfigured chains, and more too, though keep in mind
`HttpResponseOutputParser` is meant to be used directly with model output.

To learn more about what you can do with LangChain.js, check out the docs here:

- https://js.langchain.com/docs/

## ▲ Deploy on Vercel

When ready, you can deploy your app on the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## 🌐 Deploy on Netlify

You can also deploy your app on Netlify. This project includes a `netlify.toml` configuration file that sets up the necessary settings.

### Environment Variables for Netlify

This application requires the following environment variables to be set in your Netlify deployment:

1. `GOOGLE_API_KEY` - Your Google API key for Gemini AI models
2. `PINECONE_API_KEY` - Your Pinecone API key
3. `PINECONE_INDEX` - The name of your Pinecone index

To set these up:
1. Go to your Netlify site dashboard
2. Navigate to Site settings > Build & deploy > Environment variables
3. Add each required variable with its corresponding value

Without these environment variables properly configured, the application will work locally but fail when deployed to Netlify.

## Thank You!

Thanks for reading! If you have any questions or comments, reach out to us on Twitter
[@LangChainAI](https://twitter.com/langchainai), or [click here to join our Discord server](https://discord.gg/langchain).
