"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UploadDocumentsForm } from "@/components/UploadDocumentsForm";
import { UploadNoteForm } from "@/components/UploadNoteForm";
import { UploadComprehensiveActivityForm } from "@/components/UploadComprehensiveActivityForm";
import { ArrowLeft, Upload, Search, FileText, Database, Bot, StickyNote, Plus, X, Activity, Briefcase, BookOpen, Clock } from "lucide-react";
import { AgentChatInterface } from "@/components/AgentChatInterface";
import { LangGraphUI, ProcessStep } from "@/components/LangGraphUI";

const demoSteps: ProcessStep[] = [
  {
    id: '1',
    label: 'User Input',
    type: 'input' as const,
    status: 'completed' as const,
    details: 'Query processing and validation',
    timestamp: Date.now()
  },
  {
    id: '2',
    label: 'Context Retrieval',
    type: 'process' as const,
    status: 'completed' as const,
    details: 'Searching relevant documents',
    timestamp: Date.now()
  },
  {
    id: '3',
    label: 'LLM Processing',
    type: 'process' as const,
    status: 'completed' as const,
    details: 'Generating response with context',
    timestamp: Date.now()
  },
  {
    id: '4',
    label: 'Response',
    type: 'output' as const,
    status: 'completed' as const,
    details: 'Final formatted output',
    timestamp: Date.now()
  }
];

export default function RetrievalPage() {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  
  if (showUploadForm) {
    return (
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => setShowUploadForm(false)}
              className="mr-3 sm:mr-4 p-2 sm:p-3"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="text-sm sm:text-base">Back</span>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Upload Document</h1>
          </div>
          
          <div className="bg-background shadow-md rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <div className="bg-muted/50 p-4 sm:p-6 order-2 lg:order-1">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Document Upload</h2>
                    <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base">
                      Upload your documents to use them for AI-powered retrieval and chat.
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:gap-3 mb-4 sm:mb-6">
                      <div className="flex items-center p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 mr-2" />
                        <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">PDF Documents</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 mr-2" />
                        <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Text Files</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400 mr-2" />
                        <span className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">Excel Spreadsheets</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <p className="text-xs text-muted-foreground">
                      Supported formats: .txt, .pdf, .xlsx
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="col-span-1 lg:col-span-2 p-4 sm:p-6 order-1 lg:order-2">
                <UploadDocumentsForm 
                  fileTypes=".txt,.pdf,.xlsx" 
                  extractText={true}
                  onSuccess={() => setShowUploadForm(false)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (showNoteForm) {
  return (
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => setShowNoteForm(false)}
              className="mr-3 sm:mr-4 p-2 sm:p-3"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="text-sm sm:text-base">Back</span>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Add Note</h1>
          </div>
          
          <div className="bg-background shadow-md rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <div className="bg-muted/50 p-4 sm:p-6 order-2 lg:order-1">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Quick Notes</h2>
                    <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base">
                      Add personal notes, thoughts, or any information you want to remember and search later.
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:gap-3 mb-4 sm:mb-6">
                      <div className="flex items-center p-2 sm:p-3 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                        <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 dark:text-yellow-400 mr-2" />
                        <span className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">Meeting Notes</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                        <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 mr-2" />
                        <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Ideas & Thoughts</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 mr-2" />
                        <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">Personal Journal</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <p className="text-xs text-muted-foreground">
                      Notes are automatically categorized and searchable
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="col-span-1 lg:col-span-2 p-4 sm:p-6 order-1 lg:order-2">
                <UploadNoteForm 
                  onSuccess={() => setShowNoteForm(false)}
                  onCancel={() => setShowNoteForm(false)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showActivityForm) {
    return (
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center">
          <Button 
              variant="ghost" 
              onClick={() => setShowActivityForm(false)}
              className="mr-3 sm:mr-4 p-2 sm:p-3"
              size="sm"
          >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="text-sm sm:text-base">Back</span>
          </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Log Activity</h1>
          </div>
          
          <div className="bg-background shadow-md rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <div className="bg-muted/50 p-4 sm:p-6 order-2 lg:order-1">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Comprehensive Activity Tracking</h2>
                    <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base">
                      Track all types of activities including physical exercise, work tasks, study sessions, and daily routines with detailed metrics.
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:gap-3 mb-4 sm:mb-6">
                      <div className="flex items-center p-2 sm:p-3 bg-orange-100/50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
                        <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 dark:text-orange-400 mr-2" />
                        <span className="text-xs sm:text-sm text-orange-700 dark:text-orange-300">Physical Activities</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 mr-2" />
                        <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">Work & Projects</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                        <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 mr-2" />
                        <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Study & Learning</span>
                      </div>
                      <div className="flex items-center p-2 sm:p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400 mr-2" />
                        <span className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">Daily Routines</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <p className="text-xs text-muted-foreground">
                      Activities are automatically categorized and searchable with detailed insights
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="col-span-1 lg:col-span-2 p-4 sm:p-6 order-1 lg:order-2">
                <UploadComprehensiveActivityForm 
                  onSuccess={() => setShowActivityForm(false)}
                  onCancel={() => setShowActivityForm(false)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8">
      <div className="space-y-3 sm:space-y-4">
       

        <Tabs defaultValue="features" className="mt-4 sm:mt-6">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-50 bg-background h-11 sm:h-12">
            <TabsTrigger value="features" className="text-sm sm:text-base">How It Works</TabsTrigger>
            <TabsTrigger value="chat" className="text-sm sm:text-base">Chat with Context</TabsTrigger>
          </TabsList>
          
          <div className="mt-4 sm:mt-6">
            <TabsContent value="features" className="space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-semibold">How Context Retrieval Works</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Our retrieval system uses advanced AI to understand your documents/contexts and answer questions about them.
              </p>
              
              <LangGraphUI steps={demoSteps} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Document Processing */}
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 pb-3 sm:pb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">Context Processing</CardTitle>
                      <CardDescription className="text-sm">Intelligent text extraction</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      Extracts and processes text from PDFs, Word documents, and other formats. Creates searchable embeddings for semantic understanding.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-3 sm:pt-4">
                    <p>Supports: <code className="text-xs">.pdf, .txt, .xlsx</code></p>
                  </CardFooter>
                </Card>
                
                {/* Vector Storage */}
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 pb-3 sm:pb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Database className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">Vector Storage</CardTitle>
                      <CardDescription className="text-sm">Semantic search capabilities</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      Stores document content as vectors in Supabase, enabling fast semantic search and retrieval of relevant information.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-3 sm:pt-4">
                    <p>Powered by: <code className="text-xs">Supabase Vector</code></p>
                  </CardFooter>
                </Card>
                
                {/* Question Processing */}
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 pb-3 sm:pb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Search className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">Question Processing</CardTitle>
                      <CardDescription className="text-sm">Context-aware rephrasing</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      Rephrases questions into standalone queries, considering chat history and context for better document matching.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-3 sm:pt-4">
                    <p>Step 1 of the retrieval chain</p>
                  </CardFooter>
                </Card>
                
                {/* AI Response */}
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 pb-3 sm:pb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">AI Response</CardTitle>
                      <CardDescription className="text-sm">Contextual answer generation</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      Generates comprehensive answers using retrieved document context, maintaining conversation history and providing source references.
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t pt-3 sm:pt-4">
                    <p>Step 2 of the retrieval chain</p>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
            
                      <TabsContent value="chat" className="space-y-4 sm:space-y-6">
            <AgentChatInterface
                endpoint="api/chat/retrieval"
                placeholder="Hi! I'm your personal assistant. How can I help you today?"
                emoji="🤖"
                uploadButton={
                  <div className="mb-3">
                    {!showUploadOptions ? (
                      <Button 
                        onClick={() => setShowUploadOptions(true)}
                        size="sm"
                        variant="outline"
                        className="w-auto h-10 px-4 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Content
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Add Content</span>
                          <Button 
                            onClick={() => setShowUploadOptions(false)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Button 
                            onClick={() => {
                              setShowUploadForm(true);
                              setShowUploadOptions(false);
                            }}
                            size="sm"
                            variant="outline"
                            className="w-full h-10 text-sm"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Document
                          </Button>
                          <Button 
                            onClick={() => {
                              setShowNoteForm(true);
                              setShowUploadOptions(false);
                            }}
                            size="sm"
                            variant="outline"
                            className="w-full h-10 text-sm"
                          >
                            <StickyNote className="h-4 w-4 mr-2" />
                            Upload Note
                          </Button>
                          <Button 
                            onClick={() => {
                              setShowActivityForm(true);
                              setShowUploadOptions(false);
                            }}
                            size="sm"
                            variant="outline"
                            className="w-full h-10 text-sm"
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Log Activity
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                }
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
