"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Upload } from "lucide-react";
import { UploadDocumentsForm } from "./UploadDocumentsForm";

export function UploadDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Documents
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload documents to use for retrieval. Supported formats: PDF, TXT, JSON, XLSX
          </DialogDescription>
        </DialogHeader>
        <UploadDocumentsForm />
      </DialogContent>
    </Dialog>
  );
} 