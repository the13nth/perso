"use client";

import { useState, type FormEvent, useEffect } from "react";
import DEFAULT_RETRIEVAL_TEXT from "@/data/DefaultRetrievalText";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useUser } from "@clerk/nextjs";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { CheckCircle2, BookOpen, Briefcase, HeartPulse, GraduationCap, Film, Medal, Vote, Paintbrush, Star, DollarSign, HelpCircle, Globe, Lock, Upload, FileText, AlertTriangle, X } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";

export interface UploadDocumentsFormProps {
  fileTypes?: string;
  extractText?: boolean;
  onSuccess?: () => void;
}

export function UploadDocumentsForm({ 
  fileTypes, 
  extractText = false,
  onSuccess 
}: UploadDocumentsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [document, setDocument] = useState(DEFAULT_RETRIEVAL_TEXT);
  const [file, setFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [asyncProcessing, setAsyncProcessing] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["general"]);
  const [accessLevel, setAccessLevel] = useState<"public" | "personal">("personal");
  const [activeTab, setActiveTab] = useState<"document" | "settings">("document");
  const { user } = useUser();

  // Check if we're in production environment
  const isProduction = typeof window !== 'undefined' && (
    window.location.hostname.includes('netlify.app') ||
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('railway.app') ||
    window.location.hostname.includes('render.com') ||
    (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'))
  );
  
  // Document size limits
  const MAX_DOCUMENT_SIZE_PRODUCTION = 1000000; // 1MB for production
  // No limit for local development, but show async threshold
  const ASYNC_THRESHOLD_LOCAL = 50000; // 50KB async threshold for local

  // Poll for document processing status when in async processing mode
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const checkDocumentStatus = async () => {
      if (!documentId || !asyncProcessing) return;
      
      try {
        const response = await fetch(`/api/retrieval/status?documentId=${documentId}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === "complete") {
            // Document processing completed
            setAsyncProcessing(false);
            setUploadSuccess(true);
            setProcessingProgress(100);
            
            toast.success("Document processing completed successfully!", {
              duration: 5000,
              position: "top-center",
              icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
              description: "Your document has been processed and is now available in the knowledge base."
            });
            
            // Call onSuccess after document is fully processed
            if (onSuccess) {
              setTimeout(() => onSuccess(), 2000);
            }
            
            // Clear the interval
            if (intervalId) {
              clearInterval(intervalId);
            }
          } else if (data.status === "processing") {
            // Update progress
            setProcessingProgress(data.progress || 0);
          } else if (data.status === "not_found") {
            // Document not found or processing failed
            toast.error("Document processing failed or was not found", {
              duration: 5000,
              position: "top-center",
            });
            setAsyncProcessing(false);
            
            // Clear the interval
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        } else {
          console.error("Error checking document status:", response.statusText);
        }
      } catch (error) {
        console.error("Error checking document status:", error);
      }
    };
    
    // If we have a documentId and we're in async processing mode, poll for status
    if (documentId && asyncProcessing) {
      // Check immediately
      checkDocumentStatus();
      
      // Then check every 5 seconds
      intervalId = setInterval(checkDocumentStatus, 5000);
    }
    
    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [documentId, asyncProcessing, onSuccess]);

  const categoryGroups = {
    general: [
      { value: "general", label: "General", icon: <Star className="h-4 w-4" /> },
      { value: "misc", label: "Miscellaneous", icon: <HelpCircle className="h-4 w-4" /> },
    ],
    personal: [
      { value: "goals", label: "Goals", icon: <Star className="h-4 w-4" /> },
      { value: "plans", label: "Plans", icon: <Star className="h-4 w-4" /> },
      { value: "thoughts", label: "Thoughts", icon: <Star className="h-4 w-4" /> },
      { value: "routines", label: "Routines", icon: <Star className="h-4 w-4" /> },
      { value: "journal", label: "Journal", icon: <Star className="h-4 w-4" /> },
      { value: "notes", label: "Notes", icon: <Star className="h-4 w-4" /> },
      { value: "work", label: "Work", icon: <Briefcase className="h-4 w-4" /> },
      { value: "study", label: "Study", icon: <BookOpen className="h-4 w-4" /> },
      { value: "finances", label: "Finances", icon: <DollarSign className="h-4 w-4" /> },
      { value: "health", label: "Health", icon: <HeartPulse className="h-4 w-4" /> },
    ],
    domains: [
      { value: "science", label: "Science", icon: <BookOpen className="h-4 w-4" /> },
      { value: "technology", label: "Technology", icon: <BookOpen className="h-4 w-4" /> },
      { value: "business", label: "Business", icon: <Briefcase className="h-4 w-4" /> },
      { value: "education", label: "Education", icon: <GraduationCap className="h-4 w-4" /> },
      { value: "entertainment", label: "Entertainment", icon: <Film className="h-4 w-4" /> },
      { value: "sports", label: "Sports", icon: <Medal className="h-4 w-4" /> },
      { value: "politics", label: "Politics", icon: <Vote className="h-4 w-4" /> },
      { value: "arts", label: "Arts", icon: <Paintbrush className="h-4 w-4" /> },
    ]
  };

  const toggleCategory = (value: string) => {
    setSelectedCategories(current => {
      // If it's already selected, remove it (unless it's the last one)
      if (current.includes(value)) {
        const filtered = current.filter(c => c !== value);
        return filtered.length ? filtered : current; // Don't allow empty selection
      }
      // Otherwise add it
      return [...current, value];
    });
  };

  const ingest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setUploadSuccess(false);
    setAsyncProcessing(false);
    setDocumentId(null);
    setProcessingProgress(0);
    
    let textContent = document;
    
    if (extractText && file) {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user?.id || '');
      
      try {
        const response = await fetch("/api/retrieval/extract", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          textContent = data.text;
        } else {
          const error = await response.json();
          setDocument(error.message || "Error extracting text from document");
          setIsLoading(false);
          toast.error("Failed to extract text from document");
          return;
        }
      } catch {
        setDocument("Error extracting text from document");
        setIsLoading(false);
        toast.error("Failed to extract text from document");
        return;
      }
    }
    
    // Client-side document size validation
    const textLength = textContent.length;
    
    if (isProduction && textLength > MAX_DOCUMENT_SIZE_PRODUCTION) {
      setIsLoading(false);
      toast.error(
        `Document too large for free tier`, 
        {
          duration: 10000,
          position: "top-center",
          description: `Document size (${Math.round(textLength/1000)}KB) exceeds the ${Math.round(MAX_DOCUMENT_SIZE_PRODUCTION/1000)}KB free tier limit. Please upgrade to Pro plan for unlimited processing, split your document, or use the application locally.`
        }
      );
      return;
    }
    
    try {
    const response = await fetch("/api/retrieval/ingest", {
      method: "POST",
      body: JSON.stringify({
        text: textContent,
        userId: user?.id,
        categories: selectedCategories,
        access: accessLevel,
      }),
    });
      
      const data = await response.json();
    
    if (response.status === 200) {
      setDocument("Uploaded!");
      setFile(null);
      setUploadSuccess(true);
      
      toast.success(
        extractText ? "Document uploaded successfully!" : "Text uploaded successfully!", 
        {
          duration: 5000,
          position: "top-center",
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          description: "Your content has been added to the knowledge base and is ready to use."
        }
      );
      
      if (onSuccess) {
        setTimeout(() => onSuccess(), 2000);
      }
      } else if (response.status === 202) {
        // Large document is being processed asynchronously
        setAsyncProcessing(true);
        setDocumentId(data.documentId);
        
        toast.info(
          "Processing large document in the background", 
          {
            duration: 10000,
            position: "top-center",
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            description: "Your document is being processed. This may take a few minutes. You can close this window and continue using the app."
          }
        );
        
        // Don't call onSuccess yet since document is still processing
    } else if (response.status === 413) {
        // Document too large for free tier
        setDocument("Document too large for free tier");
        toast.error(
          "Document too large for free tier", 
          {
            duration: 12000,
            position: "top-center",
            description: data.message || "Please upgrade to Pro plan for unlimited document processing, split your document into smaller parts, or use the application locally.",
            action: data.upgradeRequired ? {
              label: "Upgrade to Pro",
              onClick: () => {
                // This could link to a pricing page or upgrade flow
                window.open('/pricing', '_blank');
              }
            } : undefined
          }
        );
    } else {
        setDocument(data.error || "Error uploading document");
        toast.error("Failed to upload: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error during document ingestion:", error);
      toast.error("Failed to upload document due to a network error. Please try again.");
    } finally {
    setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadSuccess(false);
      setAsyncProcessing(false);
      setProcessingProgress(0);
    }
  };

  return (
    <form onSubmit={ingest} className="grid grid-cols-1 gap-6 w-full">
      {uploadSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-green-900 dark:text-green-300">Success!</h3>
            <p className="text-green-700 dark:text-green-400 text-sm">
              {extractText ? "Document" : "Text"} has been uploaded and processed successfully.
            </p>
          </div>
        </div>
      )}
      
      {asyncProcessing && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-300">Processing Large Document</h3>
              <p className="text-amber-700 dark:text-amber-400 text-sm">
                Your document is being processed in the background. This may take a few minutes.
                You can close this window and continue using the app.
              </p>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between mb-1 text-sm">
              <span className="text-amber-800 dark:text-amber-300">Processing: {processingProgress}%</span>
            </div>
            <Progress value={processingProgress} className="h-2 bg-amber-200 dark:bg-amber-950" indicatorClassName="bg-amber-500" />
          </div>
        </div>
      )}
      
      {/* Document Size Limit Information */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Document Size Limits</h3>
            <p className="text-blue-700 dark:text-blue-400 text-sm">
              {isProduction ? (
                <>
                  <strong>Free tier limit:</strong> Maximum {Math.round(MAX_DOCUMENT_SIZE_PRODUCTION/1000)}KB per document. 
                  For larger documents, upgrade to Pro plan for unlimited processing or use the application locally.
                </>
              ) : (
                <>
                  <strong>Local development:</strong> No size limit. 
                  Documents over {Math.round(ASYNC_THRESHOLD_LOCAL/1000)}KB will be processed asynchronously.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "document" | "settings")} className="w-full">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="document" className="text-sm sm:text-base">Document</TabsTrigger>
          <TabsTrigger value="settings" className="text-sm sm:text-base">Categories & Access</TabsTrigger>
        </TabsList>
        
        <TabsContent value="document" className="space-y-6">
          {extractText ? (
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 sm:p-6 border-2 border-dashed border-border rounded-lg text-center bg-background/50">
                <Label 
                  htmlFor="document-upload"
                  className="text-base sm:text-lg font-medium block mb-2"
                >
                  Upload Document
                </Label>
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                  Drag and drop your document here or click to browse
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="flex flex-col items-center p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <FileText className="h-8 w-8 text-blue-500 dark:text-blue-400 mb-2" />
                    <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">.pdf</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-green-100/50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                    <FileText className="h-8 w-8 text-green-500 dark:text-green-400 mb-2" />
                    <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">.txt</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                    <FileText className="h-8 w-8 text-purple-500 dark:text-purple-400 mb-2" />
                    <span className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">.xlsx</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <Input 
                    id="document-upload" 
                    type="file" 
                    accept={fileTypes} 
                    onChange={handleFileChange}
                    required
                    className="max-w-xs sm:max-w-md"
                  />
                  {file && (
                    <div className="mt-4 p-3 bg-muted rounded-md inline-block">
                      <p className="text-sm text-muted-foreground flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        <span className="font-medium truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        File size: {Math.round(file.size/1024)}KB
                        {isProduction && file.size > MAX_DOCUMENT_SIZE_PRODUCTION && (
                          <span className="text-red-500 ml-2">⚠ May exceed processing limit after text extraction</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="document-text" className="text-lg font-medium">Enter Text</Label>
                  <span className={`text-sm ${
                    isProduction && document.length > MAX_DOCUMENT_SIZE_PRODUCTION
                      ? 'text-red-500 font-medium' 
                      : isProduction && document.length > MAX_DOCUMENT_SIZE_PRODUCTION * 0.8 
                        ? 'text-amber-500' 
                        : !isProduction && document.length > ASYNC_THRESHOLD_LOCAL
                          ? 'text-amber-500'
                          : 'text-muted-foreground'
                  }`}>
                    {Math.round(document.length/1000)}KB {isProduction ? `/ ${Math.round(MAX_DOCUMENT_SIZE_PRODUCTION/1000)}KB` : '(no limit)'}
                  </span>
                </div>
                <Textarea
                  id="document-text"
                  className="min-h-[300px] md:min-h-[400px] p-4 rounded"
                  value={document}
                  onChange={(e) => {
                    setDocument(e.target.value);
                    setUploadSuccess(false);
                    setAsyncProcessing(false);
                    setProcessingProgress(0);
                  }}
                  placeholder="Paste or type your text here..."
                />
                {((isProduction && document.length > MAX_DOCUMENT_SIZE_PRODUCTION) || (!isProduction && document.length > ASYNC_THRESHOLD_LOCAL)) && (
                  <p className={`text-sm ${isProduction ? 'text-red-500' : 'text-amber-500'}`}>
                    {isProduction 
                      ? `Text exceeds free tier limit (${Math.round(MAX_DOCUMENT_SIZE_PRODUCTION/1000)}KB). Please upgrade to Pro plan, reduce the text size, or use the application locally.`
                      : `Large document detected (${Math.round(document.length/1000)}KB). This will be processed asynchronously in the background.`
                    }
                  </p>
                )}
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-8">
          <div className="space-y-6">
            <h3 className="text-xl font-medium">Categories</h3>
            <p className="text-muted-foreground">Select all categories that apply to this document</p>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-lg font-medium mb-3">General</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {categoryGroups.general.map((category) => (
                    <div key={category.value} className="flex items-center space-x-2 bg-background p-2 rounded">
                      <Checkbox 
                        id={`category-${category.value}`} 
                        checked={selectedCategories.includes(category.value)}
                        onCheckedChange={() => toggleCategory(category.value)}
                      />
                      <Label 
                        htmlFor={`category-${category.value}`}
                        className="flex items-center cursor-pointer text-sm"
                      >
                        <span className="flex items-center">
                          {category.icon}
                          <span className="ml-1">{category.label}</span>
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-lg font-medium mb-3">Personal</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {categoryGroups.personal.map((category) => (
                    <div key={category.value} className="flex items-center space-x-2 bg-background p-2 rounded">
                      <Checkbox 
                        id={`category-${category.value}`} 
                        checked={selectedCategories.includes(category.value)}
                        onCheckedChange={() => toggleCategory(category.value)}
                      />
                      <Label 
                        htmlFor={`category-${category.value}`}
                        className="flex items-center cursor-pointer text-sm"
                      >
                        <span className="flex items-center">
                          {category.icon}
                          <span className="ml-1">{category.label}</span>
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-lg font-medium mb-3">Domains</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {categoryGroups.domains.map((category) => (
                    <div key={category.value} className="flex items-center space-x-2 bg-background p-2 rounded">
                      <Checkbox 
                        id={`category-${category.value}`} 
                        checked={selectedCategories.includes(category.value)}
                        onCheckedChange={() => toggleCategory(category.value)}
                      />
                      <Label 
                        htmlFor={`category-${category.value}`}
                        className="flex items-center cursor-pointer text-sm"
                      >
                        <span className="flex items-center">
                          {category.icon}
                          <span className="ml-1">{category.label}</span>
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-lg font-medium mb-3">Custom Category</h4>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Enter a custom category..."
                        className="h-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim().toLowerCase().replace(/\s+/g, '_');
                            if (value && !selectedCategories.includes(value)) {
                              setSelectedCategories(prev => [...prev, value]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Press Enter to add the category</p>
                    </div>
                  </div>
                  {selectedCategories.filter(cat => 
                    !Object.values(categoryGroups).flat().some(group => group.value === cat)
                  ).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCategories.filter(cat => 
                        !Object.values(categoryGroups).flat().some(group => group.value === cat)
                      ).map(customCat => (
                        <div key={customCat} className="flex items-center gap-2 bg-background p-2 rounded">
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3" />
                            {customCat.replace(/_/g, ' ')}
                            <button
                              type="button"
                              onClick={() => setSelectedCategories(prev => prev.filter(c => c !== customCat))}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 pt-4 border-t">
            <h3 className="text-xl font-medium">Access Level</h3>
            <p className="text-muted-foreground mb-4">Choose who can access this document</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div 
                className={`border rounded-lg p-4 cursor-pointer ${accessLevel === "personal" ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted"}`}
                onClick={() => setAccessLevel("personal")}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">Personal</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only you can access this document
                </p>
              </div>
              
              <div 
                className={`border rounded-lg p-4 cursor-pointer ${accessLevel === "public" ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted"}`}
                onClick={() => setAccessLevel("public")}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">Public</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Everyone can access this document
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 border-t">
        {activeTab === "document" ? (
          <Button 
            type="button" 
            variant="outline" 
            className="w-full order-2 sm:order-1"
            onClick={() => setActiveTab("settings")}
          >
            Next: Categories & Access
          </Button>
        ) : (
          <Button 
            type="button" 
            variant="outline" 
            className="w-full order-2 sm:order-1"
            onClick={() => setActiveTab("document")}
          >
            Back to Document
          </Button>
        )}
        
        <Button 
          type="submit" 
          disabled={!user || (extractText && !file) || isLoading || asyncProcessing}
          className={`w-full order-1 sm:order-2 ${
            uploadSuccess 
              ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800" 
              : asyncProcessing 
                ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
                : ""
          }`}
        >
          {isLoading ? (
            <div role="status" className="flex justify-center items-center">
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-primary-foreground animate-spin fill-primary/30 mr-2"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {uploadSuccess ? (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              ) : asyncProcessing ? (
                <AlertTriangle className="h-5 w-5 mr-2" />
              ) : (
                <Upload className="h-5 w-5 mr-2" />
              )}
              <span>
                {uploadSuccess 
                  ? "Uploaded Successfully" 
                  : asyncProcessing 
                    ? "Processing in Background" 
                    : "Upload Document"
                }
              </span>
            </div>
          )}
        </Button>
      </div>
    </form>
  );
}
