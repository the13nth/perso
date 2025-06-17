import { Category, CategoryService } from './types';
import { getCategory as getFirebaseCategory, 
         getRelatedCategories as getFirebaseRelatedCategories,
         updateCategoryWeight as updateFirebaseCategoryWeight } from '../../../lib/firebase/collections/categories';

export class DefaultCategoryService implements CategoryService {
  private readonly weightUpdateThreshold = 0.1; // Minimum change required to update weight

  async getCategory(id: string): Promise<Category | null> {
    console.log(`[CategoryService] Fetching category with ID: ${id}`);
    const category = await getFirebaseCategory(id);
    
    if (!category) {
      console.log(`[CategoryService] Category not found: ${id}`);
      return null;
    }

    console.log(`[CategoryService] Found category: ${category.name}`);
    return category;
  }

  async getRelatedCategories(categoryId: string): Promise<Category[]> {
    console.log(`[CategoryService] Fetching related categories for: ${categoryId}`);
    
    const categories = await getFirebaseRelatedCategories(categoryId);
    
    console.log(`[CategoryService] Found ${categories.length} related categories:`);
    categories.forEach(cat => {
      console.log(`[CategoryService] - ${cat.name} (${cat.id}), weight: ${cat.weight}`);
    });

    return categories;
  }

  async updateCategoryWeight(id: string, weight: number): Promise<void> {
    console.log(`[CategoryService] Attempting to update weight for category ${id} to ${weight}`);
    
    const category = await this.getCategory(id);
    if (!category) {
      console.error(`[CategoryService] Failed to update weight: Category ${id} not found`);
      throw new Error(`Category ${id} not found`);
    }

    const weightDiff = Math.abs(category.weight - weight);
    console.log(`[CategoryService] Current weight: ${category.weight}, New weight: ${weight}, Difference: ${weightDiff}`);

    if (weightDiff < this.weightUpdateThreshold) {
      console.log(`[CategoryService] Weight change below threshold (${this.weightUpdateThreshold}), skipping update`);
      return;
    }

    await updateFirebaseCategoryWeight(id, weight);
    console.log(`[CategoryService] Successfully updated weight for category ${id}`);
  }
} 