"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { UploadDocumentsForm } from "@/components/UploadDocumentsForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center mb-6">
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
        
        <div className="bg-background border rounded-lg p-6">
          <div className="grid gap-6">
            <UploadDocumentsForm 
              fileTypes=".txt,.pdf,.xlsx" 
              extractText={true}
              onSuccess={() => setShowUploadForm(false)}
            />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative min-h-[calc(100vh-theme(spacing.16))]">
      <ChatWindow
        endpoint="api/chat/retrieval"
        emptyStateComponent={InfoCard}
        showIngestForm={false}
        placeholder={
          'I\'ve got a nose for finding the right documents! Ask, "What is a document loader?"'
        }
        emoji="🐶"
      />
      
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8">
        <Button 
          onClick={() => setShowUploadForm(true)}
          size="lg"
          className="shadow-lg"
        >
          Upload Document
        </Button>
      </div>
    </div>
  );
}
