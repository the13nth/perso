"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { UploadDocumentsForm } from "@/components/UploadDocumentsForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Search, FileText } from "lucide-react";

export default function RetrievalPage() {
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="hidden text-l md:block">
          🔗
          <span className="ml-2">
            This template showcases how to perform retrieval with a{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            chain and the Vercel{" "}
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
        <li className="hidden text-l md:block">
          🪜
          <span className="ml-2">The chain works in two steps:</span>
          <ul>
            <li className="ml-4">
              1️⃣
              <span className="ml-2">
                First, it rephrases the input question into a
                &quot;standalone&quot; question, dereferencing pronouns based on
                the chat history.
              </span>
            </li>
            <li className="ml-4">
              2️⃣
              <span className="ml-2">
                Then, it queries the retriever for documents similar to the
                dereferenced question and composes an answer.
              </span>
            </li>
          </ul>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/retrieval/route.ts</code>.
          </span>
        </li>
        <li>
          🐶
          <span className="ml-2">
            By default, the agent is pretending to be a talking puppy, but you
            can change the prompt to whatever you want!
          </span>
        </li>
        <li className="text-l">
          🎨
          <span className="ml-2">
            The main frontend logic is found in{" "}
            <code>app/retrieval/page.tsx</code>.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🔱
          <span className="ml-2">
            Before running this example on your own, you&apos;ll first need to
            set up a Supabase vector store. See the README for more details.
          </span>
        </li>
        
      </ul>
    </GuideInfoBox>
  );
  
  if (showUploadForm) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => setShowUploadForm(false)}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-2xl font-bold">Upload Document</h1>
          </div>
          
          <div className="bg-background shadow-md rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="bg-muted/50 p-6">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-3">Document Upload</h2>
                    <p className="text-muted-foreground mb-4">
                      Upload your documents to use them for AI-powered retrieval and chat.
                    </p>
                    <div className="grid grid-cols-1 gap-3 mb-6">
                      <div className="flex items-center p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                        <span className="text-sm text-blue-700 dark:text-blue-300">PDF Documents</span>
                      </div>
                      <div className="flex items-center p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                        <FileText className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
                        <span className="text-sm text-green-700 dark:text-green-300">Text Files</span>
                      </div>
                      <div className="flex items-center p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                        <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400 mr-2" />
                        <span className="text-sm text-purple-700 dark:text-purple-300">Excel Spreadsheets</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground">
                      Supported formats: .txt, .pdf, .xlsx
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="col-span-2 p-6">
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
  
  return (
    <div className="grid grid-cols-1 min-h-[calc(100vh-theme(spacing.16))]">
      <div className="relative">
        <ChatWindow
          endpoint="api/chat/retrieval"
          emptyStateComponent={InfoCard}
          showIngestForm={false}
          placeholder={
            'I\'ve got a nose for finding the right documents! Ask, "What is a document loader?"'
          }
          emoji="🐶"
        />
        
        <div className="fixed bottom-6 right-6 z-10 flex flex-col gap-4 sm:flex-row">
          <Button 
            onClick={() => setShowUploadForm(true)}
            size="lg"
            className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center"
          >
            <Upload className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">Upload Document</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
