"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, LoaderCircle, Tag } from "lucide-react";
import { toast } from "sonner";

interface Category {
  name: string;
  count: number;
}

interface CategorySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categories: string[]) => void;
  isLoading?: boolean;
}

export function CategorySelectionModal({ isOpen, onClose, onSave, isLoading }: CategorySelectionModalProps) {
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [fetchingCategories, setFetchingCategories] = useState(false);

  // Fetch available categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setFetchingCategories(true);
    try {
      const response = await fetch('/api/retrieval/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      setAvailableCategories(data.categories || []);
    } catch (_error) {
      console.error('Error fetching categories:', _error);
      toast.error("Failed to load categories");
    } finally {
      setFetchingCategories(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const addNewCategory = () => {
    const trimmedCategory = newCategory.trim();
    if (trimmedCategory && !selectedCategories.includes(trimmedCategory)) {
      setSelectedCategories(prev => [...prev, trimmedCategory]);
      setNewCategory("");
      toast.success(`Added "${trimmedCategory}" as a new category`);
    }
  };

  const removeSelectedCategory = (categoryName: string) => {
    setSelectedCategories(prev => prev.filter(c => c !== categoryName));
  };

  const handleSave = () => {
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }
    onSave(selectedCategories);
  };

  const handleClose = () => {
    setSelectedCategories([]);
    setNewCategory("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Save to Categories
          </DialogTitle>
          <DialogDescription>
            Select one or more categories to organize this conversation in your knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Categories */}
          {selectedCategories.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Selected Categories</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedCategories.map((category) => (
                  <Badge key={category} variant="default" className="flex items-center gap-1">
                    {category}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-red-500" 
                      onClick={() => removeSelectedCategory(category)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Available Categories */}
          <div>
            <Label className="text-sm font-medium">Available Categories</Label>
            {fetchingCategories ? (
              <div className="flex items-center gap-2 py-4">
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading categories...</span>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto mt-2 space-y-2">
                {availableCategories.length > 0 ? (
                  availableCategories.map((category) => (
                    <div key={category.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.name}`}
                        checked={selectedCategories.includes(category.name)}
                        onCheckedChange={() => toggleCategory(category.name)}
                      />
                      <Label 
                        htmlFor={`category-${category.name}`} 
                        className="flex-1 text-sm cursor-pointer"
                      >
                        {category.name}
                        <span className="text-xs text-muted-foreground ml-1">({category.count})</span>
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No existing categories found</p>
                )}
              </div>
            )}
          </div>

          {/* Add New Category */}
          <div>
            <Label className="text-sm font-medium">Add New Category</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter new category name"
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
              />
              <Button 
                onClick={addNewCategory} 
                size="sm" 
                variant="outline"
                disabled={!newCategory.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || selectedCategories.length === 0}
          >
            {isLoading ? (
              <>
                <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              `Save to ${selectedCategories.length} ${selectedCategories.length === 1 ? 'Category' : 'Categories'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 