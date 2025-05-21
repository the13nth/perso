"use client";

import { useState, type FormEvent } from "react";
import DEFAULT_RETRIEVAL_TEXT from "@/data/DefaultRetrievalText";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useUser } from "@clerk/nextjs";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

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
  const { user } = useUser();

  const ingest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
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
      } catch (error) {
        setDocument("Error extracting text from document");
        setIsLoading(false);
        toast.error("Failed to extract text from document");
        return;
      }
    }
    
    const response = await fetch("/api/retrieval/ingest", {
      method: "POST",
      body: JSON.stringify({
        text: textContent,
        userId: user?.id,
      }),
    });
    
    if (response.status === 200) {
      setDocument("Uploaded!");
      setFile(null);
      toast.success(extractText ? "Document uploaded successfully!" : "Text uploaded successfully!");
      
      // Close the modal
      if (onSuccess) {
        onSuccess();
      }
    } else {
      const json = await response.json();
      if (json.error) {
        setDocument(json.error);
        toast.error("Failed to upload: " + json.error);
      }
    }
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <form onSubmit={ingest} className="flex flex-col gap-4 w-full">
      {extractText ? (
        <div className="space-y-2">
          <Label htmlFor="document-upload">Upload document</Label>
          <Input 
            id="document-upload" 
            type="file" 
            accept={fileTypes} 
            onChange={handleFileChange}
            required
          />
          {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
        </div>
      ) : (
        <Textarea
          className="grow p-4 rounded bg-transparent min-h-[512px]"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
        />
      )}
      <Button type="submit" disabled={!user || (extractText && !file)}>
        <div
          role="status"
          className={`${isLoading ? "" : "hidden"} flex justify-center`}
        >
          <svg
            aria-hidden="true"
            className="w-6 h-6 text-white animate-spin dark:text-white fill-sky-800"
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
          <span className="sr-only">Loading...</span>
        </div>
        <span className={isLoading ? "hidden" : ""}>Upload</span>
      </Button>
    </form>
  );
}
