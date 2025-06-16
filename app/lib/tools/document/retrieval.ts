import { CustomTool, ToolMetadata, ToolResult } from "../base/types";
import { RetrievalService } from "@/app/lib/services/RetrievalService";

export function createDocumentRetrievalTool(retrievalService: RetrievalService) {
  const metadata: ToolMetadata = {
    name: "document_retrieval",
    description: "Search and retrieve relevant documents from the knowledge base",
    category: "Data",
    isCustom: false,
    usageCount: 0,
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant documents"
        },
        contextType: {
          type: "string",
          description: "Type of context to search (optional)",
          enum: ["all", "documents", "notes", "activities"]
        }
      },
      required: ["query"]
    }
  };

  const executeFn = async (input: { query: string; contextType?: string }): Promise<ToolResult> => {
    try {
      const result = await retrievalService.processRetrievalRequest(
        input.query,
        input.contextType || "all"
      );

      return {
        success: true,
        result: {
          content: result.text,
          metadata: {
            contentId: result.contentId,
            createdAt: result.createdAt
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : "Failed to retrieve documents"
      };
    }
  };

  return new CustomTool({ metadata }, executeFn);
} 