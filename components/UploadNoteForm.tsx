"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useUser } from "@clerk/nextjs";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { CheckCircle2, BookOpen, Briefcase, HeartPulse, GraduationCap, Film, Medal, Paintbrush, Star, DollarSign, HelpCircle, StickyNote, PenTool } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface UploadNoteFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UploadNoteForm({ 
  onSuccess,
  onCancel
}: UploadNoteFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("notes");
  const { user } = useUser();

  const categories = [
    { value: "notes", label: "Notes", icon: <StickyNote className="h-4 w-4" /> },
    { value: "thoughts", label: "Thoughts", icon: <PenTool className="h-4 w-4" /> },
    { value: "goals", label: "Goals", icon: <Star className="h-4 w-4" /> },
    { value: "plans", label: "Plans", icon: <Star className="h-4 w-4" /> },
    { value: "journal", label: "Journal", icon: <BookOpen className="h-4 w-4" /> },
    { value: "routines", label: "Routines", icon: <Star className="h-4 w-4" /> },
    { value: "work", label: "Work", icon: <Briefcase className="h-4 w-4" /> },
    { value: "study", label: "Study", icon: <BookOpen className="h-4 w-4" /> },
    { value: "finances", label: "Finances", icon: <DollarSign className="h-4 w-4" /> },
    { value: "health", label: "Health", icon: <HeartPulse className="h-4 w-4" /> },
    { value: "business", label: "Business", icon: <Briefcase className="h-4 w-4" /> },
    { value: "education", label: "Education", icon: <GraduationCap className="h-4 w-4" /> },
    { value: "entertainment", label: "Entertainment", icon: <Film className="h-4 w-4" /> },
    { value: "sports", label: "Sports", icon: <Medal className="h-4 w-4" /> },
    { value: "arts", label: "Arts", icon: <Paintbrush className="h-4 w-4" /> },
    { value: "general", label: "General", icon: <Star className="h-4 w-4" /> },
    { value: "misc", label: "Miscellaneous", icon: <HelpCircle className="h-4 w-4" /> },
  ];

  const saveNote = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!noteText.trim()) {
      toast.error("Please enter some note content");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/retrieval/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: noteText.trim(),
          category: selectedCategory,
          userId: user?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        toast.success("Note saved successfully!", {
          duration: 4000,
          position: "top-center",
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          description: `"${data.title}" has been added to your knowledge base.`
        });

        // Reset form
        setNoteText("");
        setSelectedCategory("notes");
        
        // Call success callback
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } else {
        const errorData = await response.json();
        toast.error("Failed to save note", {
          description: errorData.message || "An error occurred while saving your note.",
        });
      }
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">Add a Note</h2>
        <p className="text-muted-foreground text-sm">
          Save your thoughts, ideas, or any information you want to be able to search and chat about later.
        </p>
      </div>

      <form onSubmit={saveNote} className="space-y-4 sm:space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-medium">Category</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full h-11 text-sm">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value} className="py-3">
                  <div className="flex items-center gap-2">
                    {category.icon}
                    <span className="text-sm">{category.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="noteText" className="text-sm font-medium">Note Content</Label>
          <Textarea
            id="noteText"
            placeholder="Write your note here... (e.g., meeting notes, ideas, reminders, thoughts)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={6}
            className="resize-none text-sm min-h-[140px] sm:min-h-[160px] leading-relaxed"
            disabled={isLoading}
          />
          <div className="text-xs text-muted-foreground text-right">
            {noteText.length}/10,000 characters
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sm:pt-4">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isLoading}
              className="w-full sm:w-auto h-11 text-sm"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isLoading || !noteText.trim()}
            className="w-full sm:flex-1 h-11 text-sm font-medium"
          >
            {isLoading ? "Saving..." : "Save Note"}
          </Button>
        </div>
      </form>
    </div>
  );
} 