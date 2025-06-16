"use client";

import { useState, type FormEvent, useEffect, ChangeEvent } from "react";
import DEFAULT_RETRIEVAL_TEXT from "@/data/DefaultRetrievalText";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useUser } from "@clerk/nextjs";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { CheckCircle2, BookOpen, Briefcase, HeartPulse, GraduationCap, Film, Medal, Vote, Paintbrush, Star, DollarSign, HelpCircle, Globe, Lock, Upload, FileText, AlertTriangle, X, Tag, Loader2, HardDrive, Tags } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import { ContentType } from '@/app/lib/content/types';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Initialize Firebase
console.log('Storage Bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

const app = !getApps().length 
  ? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    })
  : getApp();

// Initialize storage with explicit bucket
const storage = getStorage(app, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

export interface UploadDocumentsFormProps {
  fileTypes?: string;
  extractText?: boolean;
  onSuccess?: () => void;
}

interface UploadState {
  isLoading: boolean;
  uploadProgress: number;
  ingestionProgress: number;
  isIngesting: boolean;
  showSuccessModal: boolean;
  uploadedFileUrl: string | null;
  documentId: string | null;
  error: string | null;
  activeTab: "document" | "settings";
}

const initialUploadState: UploadState = {
  isLoading: false,
  uploadProgress: 0,
  ingestionProgress: 0,
  isIngesting: false,
  showSuccessModal: false,
  uploadedFileUrl: null,
  documentId: null,
  error: null,
  activeTab: "document"
};

export function UploadDocumentsForm({ 
  fileTypes, 
  extractText = false,
  onSuccess 
}: UploadDocumentsFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    isLoading: false,
    uploadProgress: 0,
    ingestionProgress: 0,
    isIngesting: false,
    showSuccessModal: false,
    uploadedFileUrl: null,
    documentId: null,
    error: null,
    activeTab: "document"
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["general"]);
  const [accessLevel, setAccessLevel] = useState<"private" | "public">("private");
  const { user } = useUser();

  // Reset state when file changes
  useEffect(() => {
    if (!file) {
      setUploadState(initialUploadState);
    }
  }, [file]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const startEmbedding = async () => {
    try {
      console.log('Starting embedding with state:', uploadState);
      
      if (!uploadState.documentId || !uploadState.uploadedFileUrl) {
        console.error('Missing document info:', { 
          documentId: uploadState.documentId, 
          uploadedFileUrl: uploadState.uploadedFileUrl 
        });
        throw new Error("Missing document information");
      }

      console.log('Document info validated, starting ingestion...');
      setUploadState(prev => ({ 
        ...prev, 
        isIngesting: true, 
        ingestionProgress: 0, 
        error: null 
      }));
      
      const requestBody = {
          documentId: uploadState.documentId,
          metadata: {
            userId: user?.id,
            fileName: file?.name,
          fileUrl: uploadState.uploadedFileUrl,
          fileType: file?.type,
          fileSize: file?.size,
            categories: selectedCategories,
            access: accessLevel,
            contentType: "document",
            originalFileName: file?.name,
            uploadedAt: new Date().toISOString(),
            status: "pending",
          processingStartedAt: new Date().toISOString(),
          source: "user-upload"
        }
      };
      
      console.log('Sending ingest request:', requestBody);
      const response = await fetch("/api/retrieval/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Ingest API error:', errorData);
        throw new Error(errorData.error || "Failed to start document processing");
      }

      const data = await response.json();
      console.log('Ingest API response:', data);
      
            setUploadState(prev => ({
              ...prev,
        documentId: data.documentId,
              isIngesting: false,
              ingestionProgress: 100,
        showSuccessModal: true
      }));

      toast.success("Document uploaded and processing started");

    } catch (error) {
      console.error('Embedding error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process document";
      
      setUploadState(prev => ({
        ...prev,
        isIngesting: false,
        ingestionProgress: 0,
        error: errorMessage
      }));
      
      toast.error(errorMessage);
    }
  };

  const ingest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      if (!user?.id) {
        throw new Error("You must be logged in to upload documents");
      }

      if (!file) {
        throw new Error("Please select a file to upload");
      }

      // Validate file size (5MB limit)
      const MAX_FILE_SIZE = 15 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size (${Math.round(file.size/1024)}KB) exceeds the ${Math.round(MAX_FILE_SIZE/1024)}KB limit`);
      }

      // Validate file type
      const allowedTypes = new Set([
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]);
      
      if (!allowedTypes.has(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Please upload PDF, TXT, or Excel files.`);
      }

      setUploadState(prev => ({
        ...prev,
        isLoading: true,
        uploadProgress: 0,
        error: null
      }));

      // Generate a unique path while preserving original filename
      const timestamp = Date.now();
      const filePath = `users/${user.id}/documents/${timestamp}/${file.name}`;

      // Create storage reference
      const storageRef = ref(storage, filePath);
      const metadata = {
        contentType: file.type,
        customMetadata: {
          userId: user.id,
          uploadedAt: new Date().toISOString(),
          originalFileName: file.name,
          fileSize: file.size.toString(),
          fileType: file.type
        }
      };

      // Upload file
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadState(prev => ({ ...prev, uploadProgress: progress }));
        },
        (error) => {
          console.error('Upload error:', error);
          let errorMessage = "Failed to upload file";
          
          // Handle specific Firebase storage errors
          switch (error.code) {
            case 'storage/unauthorized':
              errorMessage = "You don't have permission to upload files";
              break;
            case 'storage/canceled':
              errorMessage = "Upload was cancelled";
              break;
            case 'storage/unknown':
              errorMessage = "An unknown error occurred during upload";
              break;
          }
          
          setUploadState(prev => ({
            ...prev,
            isLoading: false,
            error: errorMessage
          }));
          toast.error(errorMessage);
        },
        async () => {
          try {
            console.log('Upload completed, getting download URL...');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const documentId = `${user.id}-${timestamp}`;
            
            console.log('Setting initial state with document info:', { downloadURL, documentId });
            // Update state first
            setUploadState(prev => ({
              ...prev,
              uploadedFileUrl: downloadURL,
              documentId: documentId,
              isLoading: false
            }));

            // Now start embedding with the updated state
            const requestBody = {
              documentId,
              metadata: {
                userId: user?.id,
                fileName: file?.name,
                fileUrl: downloadURL,
                fileType: file?.type,
                fileSize: file?.size,
                categories: selectedCategories,
                access: accessLevel,
                contentType: "document",
                originalFileName: file?.name,
                uploadedAt: new Date().toISOString(),
                status: "pending",
                processingStartedAt: new Date().toISOString(),
                source: "user-upload"
              }
            };
            
            console.log('Starting embedding with request:', requestBody);
            const response = await fetch("/api/retrieval/ingest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('Ingest API error:', errorData);
              throw new Error(errorData.error || "Failed to start document processing");
            }

            const data = await response.json();
            console.log('Ingest API response:', data);
            
            // Only show success modal after embedding is complete
            setUploadState(prev => ({
              ...prev,
              showSuccessModal: true
            }));

            if (onSuccess) {
              onSuccess();
            }
          } catch (error) {
            console.error('Process error:', error);
            setUploadState(prev => ({
              ...prev,
              isLoading: false,
              error: "Failed to process uploaded file"
            }));
            toast.error("Failed to process uploaded file");
          }
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
      setUploadState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      toast.error(errorMessage);
    }
  };

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

  return (
    <>
      <form onSubmit={ingest} className="grid grid-cols-1 gap-6 w-full">
        {uploadState.error && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-300">Error</h3>
                <p className="text-red-700 dark:text-red-400 text-sm">{uploadState.error}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs 
          value={uploadState.activeTab} 
          onValueChange={(v) => setUploadState(prev => ({ ...prev, activeTab: v as "document" | "settings" }))} 
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="document" className="text-sm sm:text-base">Document</TabsTrigger>
            <TabsTrigger value="settings" className="text-sm sm:text-base">Categories & Access</TabsTrigger>
          </TabsList>

          <TabsContent value="document" className="space-y-6">
            <div className="space-y-4">
              <Input
                type="file"
                onChange={handleFileChange}
                accept={fileTypes}
                disabled={uploadState.isLoading}
              />
              
              {file && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="font-medium truncate max-w-[200px] sm:max-w-xs">
                      {file.name}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    File size: {Math.round(file.size/1024)}KB
                  </p>
                  
                  {uploadState.isLoading && uploadState.uploadProgress > 0 && (
                    <div className="mt-2">
                      <Progress value={uploadState.uploadProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Uploading... {Math.round(uploadState.uploadProgress)}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                  className={`border rounded-lg p-4 cursor-pointer ${accessLevel === "private" ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted"}`}
                  onClick={() => setAccessLevel("private")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <h4 className="font-medium">Private</h4>
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
          {uploadState.activeTab === "document" ? (
            <Button 
              type="button" 
              variant="outline" 
              className="w-full order-2 sm:order-1"
              onClick={() => setUploadState(prev => ({ ...prev, activeTab: "settings" }))}
            >
              Next: Categories & Access
            </Button>
          ) : (
            <Button 
              type="button" 
              variant="outline" 
              className="w-full order-2 sm:order-1"
              onClick={() => setUploadState(prev => ({ ...prev, activeTab: "document" }))}
            >
              Back to Document
            </Button>
          )}

          <Button 
            type="submit" 
            disabled={!file || uploadState.isLoading || uploadState.isIngesting}
            className="w-full order-1 sm:order-2"
          >
            {uploadState.isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploadState.isLoading ? "Uploading..." : "Upload Document"}
          </Button>
        </div>
      </form>

      <Dialog 
        open={uploadState.showSuccessModal} 
        onOpenChange={(open) => setUploadState(prev => ({ ...prev, showSuccessModal: open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Uploaded Successfully!</DialogTitle>
            <DialogDescription className="space-y-4">
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">File Name:</span>
                  <span className="text-muted-foreground">{file?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">File Type:</span>
                  <span className="text-muted-foreground">{file?.type}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">File Size:</span>
                  <span className="text-muted-foreground">{Math.round(file?.size || 0 / 1024)}KB</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Categories:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedCategories.map((category) => (
                      <Badge key={category} variant="secondary">{category}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Access Level:</span>
                  <span className="text-muted-foreground capitalize">
                    {accessLevel}
                  </span>
                </div>
              </div>
              <p className="mt-4">Would you like to add this document to your knowledge base?</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUploadState(prev => ({ ...prev, showSuccessModal: false }));
                if (onSuccess) onSuccess();
              }}
            >
              Close
            </Button>
            <Button
              onClick={startEmbedding}
              disabled={uploadState.isIngesting}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {uploadState.isIngesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Add to Knowledge Base</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {uploadState.isIngesting && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-300">
                Processing Document
              </h3>
              <p className="text-amber-700 dark:text-amber-400 text-sm">
                Adding document to knowledge base. This may take a few minutes.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Progress 
              value={uploadState.ingestionProgress} 
              className="w-full bg-amber-200 dark:bg-amber-950" 
            />
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Progress: {Math.round(uploadState.ingestionProgress)}%
            </p>
          </div>
        </div>
      )}
    </>
  );
}
