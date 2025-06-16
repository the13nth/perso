import { CustomTool, ToolMetadata, ToolResult } from "../base/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export function createActivityAnalysisTool() {
  const metadata: ToolMetadata = {
    name: "activity_analysis",
    description: "Analyze activities and extract insights using Gemini",
    category: "Analysis",
    isCustom: false,
    usageCount: 0,
    schema: {
      type: "object",
      properties: {
        activity: {
          type: "string",
          description: "The activity text to analyze"
        },
        analysisType: {
          type: "string",
          enum: ["summary", "insights", "recommendations", "patterns"],
          description: "Type of analysis to perform"
        }
      },
      required: ["activity", "analysisType"]
    }
  };

  const executeFn = async (input: { activity: string; analysisType: string }): Promise<ToolResult> => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      let prompt = "";
      switch (input.analysisType) {
        case "summary":
          prompt = `Summarize the following activity concisely:\n\n${input.activity}`;
          break;
        case "insights":
          prompt = `Extract key insights from this activity:\n\n${input.activity}`;
          break;
        case "recommendations":
          prompt = `Based on this activity, provide actionable recommendations:\n\n${input.activity}`;
          break;
        case "patterns":
          prompt = `Identify patterns or trends in this activity:\n\n${input.activity}`;
          break;
        default:
          throw new Error(`Unsupported analysis type: ${input.analysisType}`);
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        result: {
          analysisType: input.analysisType,
          analysis: text
        }
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : "Failed to analyze activity"
      };
    }
  };

  return new CustomTool({ metadata }, executeFn);
} 