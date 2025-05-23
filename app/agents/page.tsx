import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Code, FileText, Search, Database, Image, Sparkles, Calculator, Cloud } from "lucide-react";
import { AgentChatInterface } from "@/components/AgentChatInterface";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🤝
          <span className="ml-2">
            This template showcases a{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            agent and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li>
          🛠️
          <span className="ml-2">
            The agent has memory and access to multiple tools including document analysis, weather information, database queries, image generation, code execution, web search, and calculations.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/agents/route.ts</code>.
          </span>
        </li>
        <li>
          🤖
          <span className="ml-2">
            The agent is an AI assistant that can use various tools to help solve complex tasks.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in <code>app/agents/page.tsx</code>
            .
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking e.g. <code>What's the weather forecast for London this week?</code> or <code>Compare the weather in Tokyo and Sydney</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <div className="container py-6 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">AI Agents</h1>
        <p className="text-muted-foreground">
          Agents are AI systems that can use tools to solve tasks. They combine LLMs with the ability to use specialized tools to accomplish goals.
        </p>

        <Tabs defaultValue="tools" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-50 bg-background">
            <TabsTrigger value="tools">Available Tools</TabsTrigger>
            <TabsTrigger value="chat">Chat with Agent</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="tools" className="space-y-6">
              <h2 className="text-2xl font-semibold">Available Tools</h2>
              <p className="text-muted-foreground">
                These are the specialized tools our agents can use to accomplish tasks. Each tool provides specific capabilities that enhance what the agent can do.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Document Analysis Tool */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Document Analysis</CardTitle>
                      <CardDescription>Extract insights from text</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Analyzes document content to extract key information, count words, identify main topics, and estimate reading time.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>document-analysis</code></p>
                  </CardFooter>
                </Card>
                
                {/* Weather Tool */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Cloud className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Weather</CardTitle>
                      <CardDescription>Real-time weather with AI summaries</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Real weather data from OpenWeatherMap with AI-powered conversational summaries. Provides current conditions, 5-day forecasts, and weather insights.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>weather</code></p>
                  </CardFooter>
                </Card>
                
                {/* Database Query Tool */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Database Query</CardTitle>
                      <CardDescription>Query data using natural language</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Executes natural language queries against databases. Translates questions into structured queries and retrieves results.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>database-query</code></p>
                  </CardFooter>
                </Card>
                
                {/* Image Generator Tool */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Image className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Image Generator</CardTitle>
                      <CardDescription>Create images from descriptions</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Generates images from text descriptions. Supports different art styles by specifying them in the description.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>image-generator</code></p>
                  </CardFooter>
                </Card>
                
                {/* Code Interpreter Tool */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Code className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Code Interpreter</CardTitle>
                      <CardDescription>Execute code to solve problems</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Executes JavaScript code to solve computational problems, process data, and perform complex calculations safely.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>code-interpreter</code></p>
                  </CardFooter>
                </Card>
                
                {/* Calculator Tool (Built-in) */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calculator className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Calculator</CardTitle>
                      <CardDescription>Perform mathematical calculations</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Built-in tool that evaluates mathematical expressions. Handles basic arithmetic, functions, and complex calculations.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>calculator</code></p>
                  </CardFooter>
                </Card>
                
                {/* Search Tool (Built-in) */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Web Search</CardTitle>
                      <CardDescription>Find information on the web</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Searches the web for up-to-date information using SerpAPI. Retrieves facts, news, and data from the internet.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    <p><code>serpapi</code></p>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="space-y-6">
              <AgentChatInterface
                endpoint="api/chat/agents"
                placeholder="I'm an AI assistant with access to many tools. How can I help you today?"
                emoji="🤖"
                showIntermediateStepsToggle={true}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
