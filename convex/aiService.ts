"use node";

import OpenAI from "openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { SUPPORTED_MODELS } from "./constants";

// Initialize OpenAI client
const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

// Initialize OpenRouter client
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Type definitions for unified AI response
export interface AIResponse {
  id: string;
  content: string;
  citations?: Array<{
    type: "file" | "url";
    fileId?: string;
    fileName?: string;
    url?: string;
    title?: string;
  }>;
  reasoningSummary?: string;
}

export interface StreamingAIResponse {
  stream: AsyncIterable<{
    type: "content" | "reasoning" | "citation" | "completed" | "error";
    content?: string;
    reasoning?: string;
    citation?: {
      type: "file" | "url";
      fileId?: string;
      fileName?: string;
      url?: string;
      title?: string;
    };
    id?: string;
    error?: string;
  }>;
}

export interface AIRequestOptions {
  model: string;
  input: string;
  instructions?: string;
  previousResponseId?: string;
  tools?: any[];
  vectorStoreIds?: string[];
  thinkingIntensity?: "low" | "medium" | "high";
  temperature?: number;
  webSearchEnabled?: boolean;
}

// Get model configuration
function getModelConfig(modelName: string) {
  const model = SUPPORTED_MODELS.find((m) => m.name === modelName);
  if (!model) {
    throw new Error(`Unsupported model: ${modelName}`);
  }
  return model;
}

// Generate AI response using the appropriate provider
export async function generateAIResponse(
  options: AIRequestOptions,
): Promise<StreamingAIResponse> {
  const modelConfig = getModelConfig(options.model);

  if (modelConfig.provider === "openai") {
    return generateOpenAIResponse(options, modelConfig);
  } else if (modelConfig.provider === "openrouter") {
    return generateOpenRouterResponse(options, modelConfig);
  } else {
    throw new Error(`Unsupported provider: ${(modelConfig as any).provider}`);
  }
}

// OpenAI response generation (existing logic)
async function generateOpenAIResponse(
  options: AIRequestOptions,
  modelConfig: (typeof SUPPORTED_MODELS)[number],
): Promise<StreamingAIResponse> {
  const tools = [];
  const vectorStoreIds: string[] = [];

  // Add web search tool if enabled and supported
  if (options.webSearchEnabled && modelConfig.webSearch) {
    tools.push({
      type: "web_search_preview" as const,
    });
  }

  // Add vector store IDs if provided
  if (options.vectorStoreIds) {
    vectorStoreIds.push(...options.vectorStoreIds);
  }

  // Add file search tool if we have vector stores and model supports it
  if (vectorStoreIds.length > 0 && modelConfig.fileSearch) {
    tools.push({
      type: "file_search" as const,
      vector_store_ids: vectorStoreIds,
      max_num_results: 10,
    });
  }

  const response = await openai.responses.create({
    model: options.model,
    input: options.input,
    previous_response_id: options.previousResponseId,
    instructions: options.instructions,
    tools: tools.length > 0 ? tools : undefined,
    include: tools.length > 0 ? ["file_search_call.results"] : undefined,
    reasoning: modelConfig.thinking
      ? {
          effort: options.thinkingIntensity || "medium",
          summary: "detailed",
        }
      : undefined,
    temperature: options.temperature || 1,
    top_p: 1,
    stream: true,
  });

  return {
    stream: processOpenAIStream(response),
  };
}

// OpenRouter response generation
async function generateOpenRouterResponse(
  options: AIRequestOptions,
  modelConfig: (typeof SUPPORTED_MODELS)[number],
): Promise<StreamingAIResponse> {
  const openrouterModel = (modelConfig as any).openrouterModel;
  if (!openrouterModel) {
    throw new Error(`OpenRouter model not specified for ${options.model}`);
  }

  // Build the prompt with instructions if provided
  let prompt = options.input;
  if (options.instructions) {
    prompt = `${options.instructions}\n\nUser: ${options.input}`;
  }

  const response = await streamText({
    model: openrouter(openrouterModel),
    prompt: prompt,
    temperature: options.temperature || 1,
  });

  return {
    stream: processOpenRouterStream(response, options.model),
  };
}

// Process OpenAI streaming response
async function* processOpenAIStream(response: any): AsyncGenerator<{
  type: "content" | "reasoning" | "citation" | "completed" | "error";
  content?: string;
  reasoning?: string;
  citation?: {
    type: "file" | "url";
    fileId?: string;
    fileName?: string;
    url?: string;
    title?: string;
  };
  id?: string;
  error?: string;
}> {
  let responseId = "";

  // @ts-ignore - OpenAI response stream supports async iteration
  for await (const event of response) {
    try {
      if (event.type === "response.created") {
        responseId = event.response.id;
      } else if (event.type === "response.output_text.delta") {
        yield {
          type: "content" as const,
          content: String(event.delta),
        };
      } else if (event.type === "response.reasoning_summary_text.delta") {
        yield {
          type: "reasoning" as const,
          reasoning: String(event.delta),
        };
      } else if (event.type === "response.reasoning_summary_text.done") {
        yield {
          type: "reasoning" as const,
          reasoning: String(event.text),
        };
      } else if (event.type === "response.output_text.done") {
        // Handle citations
        if (event.annotations) {
          for (const annotation of event.annotations) {
            if (annotation.type === "file_citation") {
              yield {
                type: "citation" as const,
                citation: {
                  type: "file" as const,
                  fileId: String(annotation.file_id),
                  fileName: String(annotation.filename || "unknown"),
                },
              };
            } else if (annotation.type === "url_citation") {
              yield {
                type: "citation" as const,
                citation: {
                  type: "url" as const,
                  url: String(annotation.url),
                  title: String(annotation.title || "Web Result"),
                },
              };
            }
          }
        }
      } else if (event.type === "response.completed") {
        yield {
          type: "completed" as const,
          id: responseId,
        };
        break;
      }
    } catch (streamError) {
      console.error("Error processing OpenAI stream event:", streamError);
      yield {
        type: "error" as const,
        error: String(streamError),
      };
    }
  }
}

// Process OpenRouter streaming response
async function* processOpenRouterStream(
  response: any,
  modelId: string,
): AsyncGenerator<{
  type: "content" | "reasoning" | "citation" | "completed" | "error";
  content?: string;
  reasoning?: string;
  citation?: {
    type: "file" | "url";
    fileId?: string;
    fileName?: string;
    url?: string;
    title?: string;
  };
  id?: string;
  error?: string;
}> {
  try {
    // Generate a response ID for consistency
    const responseId = `openrouter_${modelId}_${Date.now()}`;

    // Handle the streaming response differently for OpenRouter
    // The textStream might be a different type of iterator
    try {
      const stream = response.textStream;

      // Check if it's actually async iterable
      if (stream && typeof stream[Symbol.asyncIterator] === "function") {
        for await (const delta of stream) {
          yield {
            type: "content" as const,
            content: String(delta),
          };
        }
      } else {
        // Fallback to consuming the entire response
        const text = await response.text;
        yield {
          type: "content" as const,
          content: String(text),
        };
      }
    } catch (_streamError) {
      // If streaming fails, try to get the full text
      const text = await response.text;
      yield {
        type: "content" as const,
        content: String(text),
      };
    }

    yield {
      type: "completed" as const,
      id: responseId,
    };
  } catch (error) {
    console.error("Error processing OpenRouter stream:", error);
    yield {
      type: "error" as const,
      error: String(error),
    };
  }
}
