import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { auth } from '@clerk/nextjs/server';

const insightOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the key patterns observed in the documents"),
  trends: z.array(z.string()).describe("List of notable trends observed in the documents"),
  keyTopics: z.array(z.string()).describe("Key topics that appear frequently across the documents"),
  recommendations: z.array(z.string()).describe("Actionable recommendations based on document analysis"),
  connections: z.array(z.string()).describe("Interesting connections between documents or concepts"),
});

type InsightOutput = z.infer<typeof insightOutputSchema>;

const parser = StructuredOutputParser.fromZodSchema(insightOutputSchema);

const formatInstructions = parser.getFormatInstructions();

// Function to fetch embeddings from Pinecone for a specific category
async function fetchCategoryEmbeddings(category: string, userId: string, limit: number = 50) {
  try {
    const apiKey = process.env.PINECONE_API_KEY;
    const host = process.env.PINECONE_HOST;

    if (!apiKey || !host) {
      throw new Error("Missing Pinecone configuration");
    }
    
    // Remove any protocol prefix from the host if it exists
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // Prepare filter with user ID and category
    const filter: Record<string, any> = { userId };
    
    // Add category filter
    filter.categories = { $in: [category] };
    
    // Query the index directly using the host
    const queryResponse = await fetch(
      `https://${cleanHost}/query`,
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: new Array(768).fill(0), // Match index dimension of 768
          topK: limit,
          includeMetadata: true,
          includeValues: false, // We don't need the actual vectors
          filter
        }),
      }
    );

    if (!queryResponse.ok) {
      throw new Error(`Pinecone query failed: ${queryResponse.status} ${queryResponse.statusText}`);
    }

    const data = await queryResponse.json();
    
    // Extract documents from metadata
    const documents = (data.matches || []).map((match: any) => {
      return match.metadata.text || '';
    }).filter(Boolean);

    return documents;
  } catch (error) {
    console.error("Error fetching category embeddings:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { category, topWords } = await req.json();
    
    if (!category) {
      return NextResponse.json(
        { error: "Missing category parameter" },
        { status: 400 }
      );
    }

    // Fetch actual documents from Pinecone for this category
    let documents: string[];
    try {
      documents = await fetchCategoryEmbeddings(category, userId);
      
      if (documents.length === 0) {
        // If no documents found, use sample data
        documents = [
          `This is a sample document in the ${category} category as no actual documents were found.`,
          `Another sample document related to ${category} with different perspectives.`,
          `A third document exploring challenges and opportunities in ${category} fields.`
        ];
        console.log(`No documents found for category "${category}", using sample data.`);
      } else {
        console.log(`Found ${documents.length} documents for category "${category}".`);
      }
    } catch (error) {
      console.error(`Error fetching documents for category "${category}":`, error);
      // Use sample data in case of error
      documents = [
        `This is a sample document in the ${category} category due to an error fetching actual documents.`,
        `Another sample document related to ${category} with different perspectives.`,
        `A third document exploring challenges and opportunities in ${category} fields.`
      ];
    }

    // Create a prompt for the insight generation
    const prompt = new PromptTemplate({
      template: `You are an AI assistant specialized in document analysis and insight generation.
        Analyze the following ${documents.length} documents from the "{category}" category and generate structured insights.
        
        Category: {category}
        
        Top words in this category: {topWords}
        
        Documents to analyze:
        {documents}
        
        {format_instructions}
        
        Your task is to identify patterns, trends, and actionable insights from these documents.
        Focus on connections between concepts, emerging themes, and practical recommendations.
        Keep your insights specific to the category and grounded in the document content.`,
      inputVariables: ["category", "documents", "topWords"],
      partialVariables: { format_instructions: formatInstructions },
    });
    
    // Sample top words if not provided
    const sampleTopWords = topWords?.join(", ") || "sample, words, for, testing";
    
    // Limit document length to avoid token limits
    const truncatedDocuments = documents.map(doc => {
      if (doc.length > 500) {
        return doc.substring(0, 500) + "...";
      }
      return doc;
    });
    
    // If we have too many documents, sample a subset
    const MAX_DOCS = 10;
    let docsForAnalysis = truncatedDocuments;
    if (truncatedDocuments.length > MAX_DOCS) {
      docsForAnalysis = truncatedDocuments
        .sort(() => 0.5 - Math.random()) // Shuffle
        .slice(0, MAX_DOCS);
    }
    
    const formattedPrompt = await prompt.format({
      category: category,
      documents: docsForAnalysis.join("\n\n"),
      topWords: sampleTopWords
    });
    
    // Use Gemini to generate insights
    const model = await initializeGeminiModel({
      temperature: 0.7,
      maxOutputTokens: 2048
    });
    
    const response = await model.invoke(formattedPrompt);
    const responseText = response.content.toString();
    
    try {
      // Parse the output to ensure it matches our schema
      const structuredOutput = await parser.parse(responseText);
      return NextResponse.json({
        ...structuredOutput,
        documentCount: documents.length, // Return the number of documents analyzed
        sampledCount: docsForAnalysis.length // Return how many documents were actually used
      });
    } catch (error) {
      // If parsing fails, still return the raw response
      console.error("Error parsing model output:", error);
      return NextResponse.json({ 
        error: "Failed to parse AI response",
        rawOutput: responseText 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
} 