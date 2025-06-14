import { useState, FormEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";

interface UploadNotesFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface NoteState {
  isLoading: boolean;
  title: string;
  content: string;
  format: 'text' | 'markdown' | 'rich-text';
  categories: string[];
  customCategory: string;
  access: 'personal' | 'public';
  isPinned: boolean;
  isStarred: boolean;
  color?: string;
  showSuccessModal: boolean;
  noteId: string | null;
  error: string | null;
}

const initialNoteState: NoteState = {
  isLoading: false,
  title: "",
  content: "",
  format: 'text',
  categories: [],
  customCategory: "",
  access: 'personal',
  isPinned: false,
  isStarred: false,
  color: undefined,
  showSuccessModal: false,
  noteId: null,
  error: null
};

const GENERAL_CATEGORIES = ["Personal", "Work", "Study", "Ideas", "Tasks"];
const DOMAIN_CATEGORIES = ["Technical", "Creative", "Business", "Health", "Finance"];

export function UploadNotesForm({ onSuccess, onCancel }: UploadNotesFormProps) {
  const { user } = useUser();
  const [state, setState] = useState<NoteState>(initialNoteState);
  const [activeTab, setActiveTab] = useState<"note" | "settings">("note");

  const addCategory = (category: string) => {
    if (!state.categories.includes(category)) {
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, category]
      }));
    }
  };

  const removeCategory = (category: string) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category)
    }));
  };

  const addCustomCategory = () => {
    if (state.customCategory && !state.categories.includes(state.customCategory)) {
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, prev.customCategory],
        customCategory: ""
      }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error("You must be logged in to save notes");
      return;
    }

    if (!state.content.trim()) {
      toast.error("Note content cannot be empty");
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch("/api/retrieval/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: state.content.trim(),
          title: state.title.trim() || '',
          userId: user.id,
          categories: state.categories,
          access: state.access || 'personal',
          format: state.format || 'text',
          isPinned: Boolean(state.isPinned),
          isStarred: Boolean(state.isStarred),
          color: state.color || null
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          showSuccessModal: true,
          noteId: data.noteId
        }));

        toast.success("Note saved successfully!", {
          duration: 4000,
          position: "top-center",
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          description: "Your note has been saved and indexed."
        });

        if (onSuccess) {
          onSuccess();
        }
      } else {
        const error = await response.json();
        toast.error("Failed to save note", {
          description: error.message || "An error occurred while saving your note.",
        });
      }
    } catch (_error) {
      console.error("Error saving note:", _error);
      toast.error("Failed to save note", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "note" | "settings")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="note">Note Content</TabsTrigger>
            <TabsTrigger value="settings">Categories & Access</TabsTrigger>
          </TabsList>

          <TabsContent value="note" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Note title..."
                value={state.title}
                onChange={(e) => setState(prev => ({ ...prev, title: e.target.value }))}
                disabled={state.isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Write your note here..."
                value={state.content}
                onChange={(e) => setState(prev => ({ ...prev, content: e.target.value }))}
                rows={10}
                className="resize-none"
                disabled={state.isLoading}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveTab("settings")}
                disabled={state.isLoading}
              >
                Next: Categories & Access
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>General Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {GENERAL_CATEGORIES.map(category => (
                    <Badge
                      key={category}
                      variant={state.categories.includes(category) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => state.categories.includes(category) 
                        ? removeCategory(category)
                        : addCategory(category)
                      }
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Domain Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DOMAIN_CATEGORIES.map(category => (
                    <Badge
                      key={category}
                      variant={state.categories.includes(category) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => state.categories.includes(category)
                        ? removeCategory(category)
                        : addCategory(category)
                      }
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add custom category..."
                  value={state.customCategory}
                  onChange={(e) => setState(prev => ({ ...prev, customCategory: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomCategory()}
                  disabled={state.isLoading}
                />
                <Button
                  type="button"
                  onClick={addCustomCategory}
                  disabled={state.isLoading || !state.customCategory}
                >
                  Add
                </Button>
              </div>

              <div>
                <Label>Selected Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {state.categories.map(category => (
                    <Badge
                      key={category}
                      className="cursor-pointer flex items-center gap-1"
                    >
                      {category}
                      <X
                        className="h-3 w-3"
                        onClick={() => removeCategory(category)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Access Level</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={state.access === 'personal' ? 'default' : 'outline'}
                    onClick={() => setState(prev => ({ ...prev, access: 'personal' }))}
                    disabled={state.isLoading}
                  >
                    Personal
                  </Button>
                  <Button
                    type="button"
                    variant={state.access === 'public' ? 'default' : 'outline'}
                    onClick={() => setState(prev => ({ ...prev, access: 'public' }))}
                    disabled={state.isLoading}
                  >
                    Public
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("note")}
                disabled={state.isLoading}
              >
                Back to Note
              </Button>
              <div className="flex gap-3">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={state.isLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={state.isLoading || !state.content.trim()}
                >
                  {state.isLoading ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
} 