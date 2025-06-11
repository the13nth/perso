"use client";

import { useState, useCallback, Suspense } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UploadDocumentsForm } from "@/components/UploadDocumentsForm";
import { UploadNoteForm } from "@/components/UploadNoteForm";
import { UploadComprehensiveActivityForm } from "../components/UploadComprehensiveActivityForm";
import { ArrowLeft, Upload, Search, FileText, Database, Bot, StickyNote, Plus, X, Activity, Briefcase, BookOpen, Clock, Loader2 } from "lucide-react";
import { AgentChatInterface } from "@/components/AgentChatInterface";
import { LangGraphUI, ProcessStep } from "@/components/LangGraphUI";

// Types for better type safety
interface FormProps {
  onBack: () => void;
  title: string;
}

interface UploadOptionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

// Demo steps for the process visualization
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
    label: 'Query Clarification',
    type: 'process' as const,
    status: 'completed' as const,
    details: 'LLM analyzes and clarifies user intent',
    timestamp: Date.now()
  },
  {
    id: '3',
    label: 'Context Retrieval',
    type: 'process' as const,
    status: 'completed' as const,
    details: 'Searching relevant documents with clarified query',
    timestamp: Date.now()
  },
  {
    id: '4',
    label: 'LLM Processing',
    type: 'process' as const,
    status: 'completed' as const,
    details: 'Generating response with context',
    timestamp: Date.now()
  },
  {
    id: '5',
    label: 'Response',
    type: 'output' as const,
    status: 'completed' as const,
    details: 'Final formatted output',
    timestamp: Date.now()
  }
];

/**
 * Document Upload Form component
 */
function DocumentUploadForm({ onBack, title }: FormProps) {
  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mr-3 sm:mr-4 p-2 sm:p-3"
            size="sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />
            <span className="text-sm sm:text-base">Back</span>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
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
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">PDF Documents</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Text Files</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400 mr-2" aria-hidden="true" />
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
                onSuccess={onBack}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Note Upload Form component
 */
function NoteUploadForm({ onBack, title }: FormProps) {
  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mr-3 sm:mr-4 p-2 sm:p-3"
            size="sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />
            <span className="text-sm sm:text-base">Back</span>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
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
                      <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 dark:text-yellow-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">Meeting Notes</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Ideas & Thoughts</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 mr-2" aria-hidden="true" />
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
                onSuccess={onBack}
                onCancel={onBack}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Activity Upload Form component
 */
function ActivityUploadForm({ onBack, title }: FormProps) {
  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mr-3 sm:mr-4 p-2 sm:p-3"
            size="sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />
            <span className="text-sm sm:text-base">Back</span>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
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
                      <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 dark:text-orange-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-orange-700 dark:text-orange-300">Physical Activities</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">Work & Projects</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 mr-2" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Study & Learning</span>
                    </div>
                    <div className="flex items-center p-2 sm:p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400 mr-2" aria-hidden="true" />
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
                onSuccess={onBack}
                onCancel={onBack}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Upload Option Button component
 */
function UploadOptionButton({ icon, label, onClick }: UploadOptionProps) {
  return (
    <Button 
      onClick={onClick}
      size="sm"
      variant="outline"
      className="w-full h-10 text-sm"
      aria-label={label}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </Button>
  );
}

/**
 * Feature Card component
 */
function FeatureCard({ 
  icon, 
  title, 
  description, 
  footer 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  footer: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 pb-3 sm:pb-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground border-t pt-3 sm:pt-4">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}

/**
 * Main content component
 */
function RetrievalContent() {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [activeTab, setActiveTab] = useState('features');
  
  // Handle tab change
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);
  
  // Handle back button click
  const handleBack = useCallback(() => {
    setShowUploadForm(false);
    setShowNoteForm(false);
    setShowActivityForm(false);
  }, []);
  
  // Toggle upload options
  const toggleUploadOptions = useCallback(() => {
    setShowUploadOptions(prev => !prev);
  }, []);
  
  // Show document upload form
  const showDocumentUpload = useCallback(() => {
    setShowUploadForm(true);
    setShowUploadOptions(false);
  }, []);
  
  // Show note upload form
  const showNoteUpload = useCallback(() => {
    setShowNoteForm(true);
    setShowUploadOptions(false);
  }, []);
  
  // Show activity upload form
  const showActivityUpload = useCallback(() => {
    setShowActivityForm(true);
    setShowUploadOptions(false);
  }, []);
  
  // Render document upload form
  if (showUploadForm) {
    return <DocumentUploadForm onBack={handleBack} title="Upload Document" />;
  }
  
  // Render note upload form
  if (showNoteForm) {
    return <NoteUploadForm onBack={handleBack} title="Add Note" />;
  }
  
  // Render activity upload form
  if (showActivityForm) {
    return <ActivityUploadForm onBack={handleBack} title="Log Activity" />;
  }
  
  // Render main content
  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8">
      <div className="space-y-3 sm:space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4 sm:mt-6">
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
                <FeatureCard 
                  icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />}
                  title="Context Processing"
                  description="Extracts and processes text from PDFs, Word documents, and other formats. Creates searchable embeddings for semantic understanding."
                  footer="Supports: .pdf, .txt, .xlsx"
                />
                
                <FeatureCard 
                  icon={<Database className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />}
                  title="Vector Storage"
                  description="Stores document content as vectors in Supabase, enabling fast semantic search and retrieval of relevant information."
                  footer="Powered by: Supabase Vector"
                />
                
                <FeatureCard 
                  icon={<Search className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />}
                  title="Query Clarification"
                  description="Uses AI to understand, clarify and improve user queries before searching. Makes implicit references explicit and adds context from chat history for better document matching."
                  footer="Enhanced query processing with fallback to original"
                />
                
                <FeatureCard 
                  icon={<Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />}
                  title="AI Response"
                  description="Generates comprehensive answers using retrieved document context, maintaining conversation history and providing source references."
                  footer="Step 2 of the retrieval chain"
                />
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
                        onClick={toggleUploadOptions}
                        size="sm"
                        variant="outline"
                        className="w-auto h-10 px-4 text-sm"
                        aria-label="Add content"
                      >
                        <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                        <span>Add Content</span>
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Add Content</span>
                          <Button 
                            onClick={toggleUploadOptions}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            aria-label="Close options"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <UploadOptionButton 
                            icon={<Upload className="h-4 w-4" aria-hidden="true" />}
                            label="Upload Document"
                            onClick={showDocumentUpload}
                          />
                          <UploadOptionButton 
                            icon={<StickyNote className="h-4 w-4" aria-hidden="true" />}
                            label="Upload Note"
                            onClick={showNoteUpload}
                          />
                          <UploadOptionButton 
                            icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                            label="Log Activity"
                            onClick={showActivityUpload}
                          />
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

/**
 * Main page component with Suspense for loading state
 */
export default function RetrievalPage() {
  return (
    <Suspense fallback={
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading retrieval page...</span>
        </div>
      </div>
    }>
      <RetrievalContent />
    </Suspense>
  );
}
