import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Detects the language of the given text
 */
export async function detectLanguage(text: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      contents: [{ 
        role: 'user',
        parts: [{ text: `Analyze this text and return ONLY the ISO 639-1 language code (e.g. 'en' for English): "${text.slice(0, 500)}..."` }]
      }]
    });
    const response = result.response.text().trim().toLowerCase();
    return response.length === 2 ? response : 'en';
  } catch (_error) {
    console.error('Error detecting language:', _error);
    return 'en'; // Default to English on error
  }
}

/**
 * Assesses the complexity level of the given text
 */
export async function assessComplexity(text: string): Promise<'basic' | 'intermediate' | 'advanced'> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      contents: [{ 
        role: 'user',
        parts: [{ text: `Analyze this text and return ONLY 'basic', 'intermediate', or 'advanced' based on its complexity level: "${text.slice(0, 500)}..."` }]
      }]
    });
    const response = result.response.text().trim().toLowerCase();
    return response as 'basic' | 'intermediate' | 'advanced';
  } catch (_error) {
    console.error('Error assessing complexity:', _error);
    return 'intermediate'; // Default to intermediate on error
  }
}

/**
 * Extracts main topics from the given text
 */
export async function extractTopics(text: string): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      contents: [{ 
        role: 'user',
        parts: [{ text: `Extract 3-5 main topics from this text. Return ONLY a comma-separated list of single words or short phrases: "${text.slice(0, 1000)}..."` }]
      }]
    });
    const response = result.response.text().trim();
    return response.split(',').map((topic: string) => topic.trim());
  } catch (_error) {
    console.error('Error extracting topics:', _error);
    return []; // Return empty array on error
  }
} 