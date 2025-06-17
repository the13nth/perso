import { db } from '../config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { Category } from '../../../app/lib/retrieval/types';

// Collection reference
const categoriesCollection = collection(db, 'categories');

export async function getCategory(id: string): Promise<Category | null> {
  const docRef = doc(categoriesCollection, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description,
    parentId: data.parentId,
    weight: data.weight || 1
  };
}

export async function saveCategory(category: Category): Promise<void> {
  const docRef = doc(categoriesCollection, category.id);
  await setDoc(docRef, {
    name: category.name,
    description: category.description,
    parentId: category.parentId,
    weight: category.weight || 1
  });
}

export async function updateCategoryWeight(id: string, weight: number): Promise<void> {
  const docRef = doc(categoriesCollection, id);
  await updateDoc(docRef, { weight });
}

export async function getRelatedCategories(categoryId: string): Promise<Category[]> {
  const category = await getCategory(categoryId);
  if (!category) return [];

  // Get categories with same parent
  const siblingQuery = category.parentId 
    ? query(categoriesCollection, where('parentId', '==', category.parentId))
    : null;

  // Get child categories
  const childrenQuery = query(categoriesCollection, where('parentId', '==', categoryId));

  // Execute queries in parallel
  const [siblingsSnapshot, childrenSnapshot] = await Promise.all([
    siblingQuery ? getDocs(siblingQuery) : Promise.resolve(null),
    getDocs(childrenQuery)
  ]);

  // Get parent if exists
  const parentCategory = category.parentId 
    ? await getCategory(category.parentId)
    : null;

  // Combine results
  const relatedCategories: Category[] = [];

  if (parentCategory) {
    relatedCategories.push(parentCategory);
  }

  if (siblingsSnapshot) {
    siblingsSnapshot.docs.forEach(doc => {
      if (doc.id !== categoryId) { // Exclude the original category
        const data = doc.data();
        relatedCategories.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          parentId: data.parentId,
          weight: data.weight || 1
        });
      }
    });
  }

  childrenSnapshot.docs.forEach(doc => {
    const data = doc.data();
    relatedCategories.push({
      id: doc.id,
      name: data.name,
      description: data.description,
      parentId: data.parentId,
      weight: data.weight || 1
    });
  });

  return relatedCategories;
} 