"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@clerk/nextjs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, BookOpen, Briefcase, HeartPulse, GraduationCap, Film, Medal, Paintbrush, Star, DollarSign, HelpCircle, StickyNote, PenTool } from "lucide-react";
import Select, { StylesConfig } from 'react-select';

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
  const [selectedCategory, setSelectedCategory] = useState("");
  const { user } = useUser();

  const categories = [
    { value: "general", label: "General Notes", icon: StickyNote },
    { value: "work", label: "Work", icon: Briefcase },
    { value: "study", label: "Study", icon: BookOpen },
    { value: "health", label: "Health", icon: HeartPulse },
    { value: "learning", label: "Learning", icon: GraduationCap },
    { value: "entertainment", label: "Entertainment", icon: Film },
    { value: "achievement", label: "Achievement", icon: Medal },
    { value: "creative", label: "Creative", icon: Paintbrush },
    { value: "ideas", label: "Ideas", icon: Star },
    { value: "financial", label: "Financial", icon: DollarSign },
    { value: "question", label: "Questions", icon: HelpCircle },
    { value: "personal", label: "Personal", icon: PenTool }
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!noteText.trim()) {
      toast.error("Please enter your note");
      return;
    }

    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to upload notes");
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
          text: noteText,
          category: selectedCategory,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload note");
      }

      await response.json();
      
      toast.success("Note uploaded successfully!", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      
      // Reset form
      setNoteText("");
      setSelectedCategory("");
      
      // Call success callback
      onSuccess?.();

    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload note");
    } finally {
      setIsLoading(false);
    }
  };

  const selectOptions = categories.map(category => ({
    value: category.value,
    label: category.label
  }));

  const customSelectStyles: StylesConfig<{value: string, label: string}, false> = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '44px',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      backgroundColor: 'hsl(var(--background))',
      '&:hover': {
        borderColor: 'hsl(var(--border))'
      },
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring))' : 'none',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))'
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'hsl(var(--accent))' 
        : state.isFocused 
          ? 'hsl(var(--accent) / 0.5)' 
          : 'transparent',
      color: 'hsl(var(--foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--accent))'
      }
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'hsl(var(--foreground))'
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'hsl(var(--muted-foreground))'
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px'
    })
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card rounded-lg border shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Upload Note</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-medium">
            Category
          </Label>
          <Select
            options={selectOptions}
            value={selectOptions.find(option => option.value === selectedCategory) || null}
            onChange={(option) => setSelectedCategory(option?.value || "")}
            placeholder="Select a category"
            isDisabled={isLoading}
            styles={customSelectStyles}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note" className="text-sm font-medium">
            Note Content
          </Label>
          <Textarea
            id="note"
            placeholder="Write your note here..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[120px] resize-none"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Uploading..." : "Upload Note"}
          </Button>
          
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
} 