import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const MODEL_VERSIONS = [
  // "gemini-2.5-pro",     // Highest capability model
  "gemini-2.5-flash",   // Fast model with good capabilities
  "gemini-2.0-flash",   // Fallback to older version
  // "gemini-2.0-flash-lite" // Lightweight fallback option
];

export async function initializeGeminiModel(options: {
  temperature?: number;
  maxOutputTokens?: number;
}) {
  let lastError: Error | null = null;
  
  for (const modelVersion of MODEL_VERSIONS) {
    try {
      const model = new ChatGoogleGenerativeAI({
        model: modelVersion,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      });
      
      // Test the model with a simple prompt to ensure it works
      await model.invoke("test");
      console.log(`Successfully initialized model: ${modelVersion}`);
      return model;
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`Failed to initialize ${modelVersion}:`, error);
        lastError = error;
      } else {
        console.warn(`Failed to initialize ${modelVersion} with unknown error:`, error);
        lastError = new Error(String(error));
      }
    }
  }
  
  throw new Error(`Failed to initialize any Gemini model. Last error: ${lastError?.message}`);
} 