"use node"; // Explicitly mark as Node.js environment

// Polyfill for File API in Node.js
import { File as BufferFile } from "node:buffer";
if (typeof (globalThis as any).File === "undefined") {
  (globalThis as any).File = BufferFile;
}

import OpenAI from "openai";
import { internal } from "./_generated/api";
import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { ActionCtx } from "./_generated/server";
import { getLoggedInUser } from "./chatQueriesAndMutations";
import { type CoreMessage } from "ai";
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  isSupportedFileExtension,
  getMimeType,
  isSupportedModel,
  isThinkingModel,
  isOpenRouterModel,
  SYSTEM_PROMPT,
} from "./constants";

// Type definitions for OpenAI response structures
interface FileCitationAnnotation {
  type: "file_citation";
  file_id: string;
  filename?: string;
}

interface UrlCitationAnnotation {
  type: "url_citation";
  url: string;
  title?: string;
}

type Annotation = FileCitationAnnotation | UrlCitationAnnotation;

interface OutputItemWithAnnotations {
  annotations?: Annotation[];
}

interface OutputTextContent {
  type: "output_text";
  annotations?: Annotation[];
}

interface ResponseOutput {
  type: string;
  content?: OutputTextContent[];
}

// OpenAI client will be created with user's API key in each action

// Helper function to extract meaningful error messages for users
function getUserFriendlyErrorMessage(error: any): string {
  if (error && typeof error === "object") {
    // OpenAI API errors
    if (error.error && error.error.message) {
      const message = error.error.message;

      // Handle specific OpenAI error types
      if (error.error.code === "invalid_api_key") {
        return "Invalid API key. Please check your API key in Settings.";
      } else if (error.error.code === "insufficient_quota") {
        return "API quota exceeded. Please check your OpenAI account balance.";
      } else if (error.error.code === "rate_limit_exceeded") {
        return "Rate limit exceeded. Please try again in a moment.";
      } else if (error.error.code === "model_not_found") {
        return "Selected model is not available. Please try a different model.";
      }
      if (error.code === 401 && error.message.includes("No auth credentials")) {
        return "Invalid OpenRouter API key. Please check your OpenRouter API key in Settings.";
      }

      // Return the original error message for other API errors
      return message;
    }

    // Generic error message
    if (error.message) {
      return error.message;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

// Action that uses OpenAI Responses API to generate AI responses with file search
export const generateAiResponse = internalAction({
  args: {
    conversationId: v.id("conversations"),
    openaiApiKey: v.optional(v.string()),
    openrouterApiKey: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    args: {
      conversationId: Id<"conversations">;
      openaiApiKey?: string;
      openrouterApiKey?: string;
    },
  ) => {
    try {
      // Get the conversation to check for previous response ID and vector store
      const conversation = await ctx.runQuery(
        internal.chatQueriesAndMutations.getConversation,
        {
          conversationId: args.conversationId,
        },
      );

      if (!conversation) {
        console.error("Conversation not found:", args.conversationId);
        return;
      }

      // Get the most recent user message as the input
      const lastMessage = await ctx.runQuery(
        internal.chatQueriesAndMutations.getLastUserMessage,
        {
          conversationId: args.conversationId,
        },
      );

      if (!lastMessage) {
        console.error(
          "No user message found in conversation:",
          args.conversationId,
        );
        return;
      }

      // Build the input for the current user message
      const inputContent = [];

      // Add text content if present
      if (lastMessage.content.trim()) {
        inputContent.push(lastMessage.content);
      }

      // Add file attachments if present (for now, just mention them)
      if (lastMessage.fileIds && lastMessage.fileIds.length > 0) {
        inputContent.push(`[${lastMessage.fileIds.length} file(s) attached]`);
      }

      if (inputContent.length === 0) {
        console.error("No content found in user message");
        return;
      }

      const inputText = inputContent.join("\n");

      // Prepare tools based on user preferences and available resources
      const tools = [];
      const vectorStoreIds: string[] = [];

      // Check if web search was enabled for this message
      const webSearchEnabled = lastMessage.webSearchEnabled === true;

      if (webSearchEnabled) {
        // Add web search tool
        tools.push({
          type: "web_search_preview" as const,
        });
      }

      // Include conversation-specific vector store if it exists
      if (conversation.vectorStoreId) {
        vectorStoreIds.push(conversation.vectorStoreId);
      }

      // Add file search tool if we have vector stores
      if (vectorStoreIds.length > 0) {
        tools.push({
          type: "file_search" as const,
          vector_store_ids: vectorStoreIds,
          max_num_results: 10, // Limit results for better performance
        });
      }

      // Get the model and thinking intensity from the last user message (default to gpt-4.1)
      let selectedModel = lastMessage.model || "gpt-4.1";
      const thinkingIntensity = lastMessage.thinkingIntensity || "medium";

      // Validate the model is supported
      if (!isSupportedModel(selectedModel)) {
        console.error(
          `Unsupported model in message: ${selectedModel}, falling back to gpt-4.1`,
        );
        selectedModel = "gpt-4.1";
      }

      // Create an initial AI message with typing status
      const aiMessageId = await ctx.runMutation(
        internal.chatQueriesAndMutations.storeAiMessage,
        {
          conversationId: args.conversationId,
          content: "",
          status: "typing",
        },
      );

      // Use the timezone from the last user message if available; fallback to UTC
      const userTimezone =
        (lastMessage as { timezone?: string }).timezone || "UTC";

      const time_format = new Date().toLocaleString("en-US", {
        timeZone: userTimezone,
        timeZoneName: "shortOffset",
      });

      let sysPrompt = SYSTEM_PROMPT;
      sysPrompt = sysPrompt.replaceAll("{model-name}", selectedModel);
      sysPrompt = sysPrompt.replaceAll(
        "{user-time-with-timezone}",
        time_format,
      );

      try {
        if (isOpenRouterModel(selectedModel)) {
          // Validate API key for OpenRouter models
          if (!args.openrouterApiKey) {
            throw new Error("OpenRouter API key is required for this model");
          }

          // Use OpenAI SDK with OpenRouter base URL for unified handling
          const openrouterClient = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: args.openrouterApiKey,
          });

          // Get recent messages for conversation history
          const recentMessages = (
            await ctx.runQuery(
              internal.chatQueriesAndMutations.getRecentMessages,
              {
                conversationId: args.conversationId,
                userId: conversation.userId,
              },
            )
          ).reverse();

          const history: CoreMessage[] = recentMessages.map(
            (message): CoreMessage => {
              // @ts-expect-error: Intentional comparison between 'ai' and 'assistant'/'user' for mapping roles
              if (message.author === "ai") {
                return {
                  role: "assistant",
                  content: message.content,
                };
              } else {
                return {
                  role: "user",
                  content: message.content,
                };
              }
            },
          );

          const webSearchEnabled = lastMessage.webSearchEnabled === true;
          let modelForApi: string = selectedModel;
          if (webSearchEnabled) {
            modelForApi = `${selectedModel}:online`;
          }

          const reasoningParams: { effort?: "low" | "medium" | "high" } = {};
          if (thinkingIntensity) {
            reasoningParams.effort = thinkingIntensity;
          }

          // Use the working message format for web search, with streaming and context
          if (webSearchEnabled) {
            console.log(
              "Web search enabled, using hybrid streaming + citations approach",
            );

            // Build messages in the format that works with OpenRouter web search
            const messages: Array<{
              role: "system" | "user" | "assistant";
              content: Array<{ type: "text"; text: string }> | string;
            }> = [];

            // Add system message as string
            messages.push({
              role: "system",
              content: sysPrompt,
            });

            // Add conversation history with proper format
            for (const message of history) {
              if (message.role === "assistant") {
                // Extract text content from assistant message
                const textContent =
                  typeof message.content === "string"
                    ? message.content
                    : Array.isArray(message.content)
                      ? message.content
                          .map((part) => ("text" in part ? part.text : ""))
                          .join("")
                      : String(message.content);

                messages.push({
                  role: "assistant",
                  content: textContent,
                });
              } else {
                // Extract text content from user message
                const textContent =
                  typeof message.content === "string"
                    ? message.content
                    : Array.isArray(message.content)
                      ? message.content
                          .map((part) => ("text" in part ? part.text : ""))
                          .join("")
                      : String(message.content);

                messages.push({
                  role: "user",
                  content: [{ type: "text", text: textContent }],
                });
              }
            }

            // Add the current user message in the array format
            messages.push({
              role: "user",
              content: [{ type: "text", text: inputText }],
            });

            const streamingParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
              {
                model: modelForApi,
                messages:
                  messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                stream: true, // Enable streaming
              };

            if (Object.keys(reasoningParams).length > 0) {
              (streamingParams as any).reasoning = reasoningParams;
            }

            console.log("Starting streaming response with context:", {
              model: streamingParams.model,
              messageCount: streamingParams.messages.length,
              hasSystemMessage: streamingParams.messages[0]?.role === "system",
            });

            // Start streaming response for real-time content
            const responseStream =
              await openrouterClient.chat.completions.create(streamingParams);

            let reasoningSummary = "";

            for await (const chunk of responseStream) {
              const delta = chunk.choices[0]?.delta;
              if (!delta) continue;

              if (delta.content) {
                await ctx.runMutation(
                  internal.chatQueriesAndMutations.appendMessageContent,
                  {
                    messageId: aiMessageId,
                    content: delta.content,
                  },
                );
              }

              const reasoningDelta = (delta as any).reasoning;
              if (reasoningDelta) {
                reasoningSummary += reasoningDelta;
                await ctx.runMutation(
                  internal.chatQueriesAndMutations.updateReasoningSummary,
                  {
                    messageId: aiMessageId,
                    reasoningSummary: reasoningSummary,
                  },
                );
              }
            }

            console.log("Streaming completed, now fetching citations...");

            // Now make a separate non-streaming call to get citations
            // Use just the current message for citation extraction to be fast
            const citationParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
              {
                model: modelForApi,
                messages: [
                  {
                    role: "user",
                    content: [{ type: "text", text: inputText }],
                  },
                ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                stream: false,
              };

            if (Object.keys(reasoningParams).length > 0) {
              (citationParams as any).reasoning = reasoningParams;
            }

            try {
              const citationResponse =
                await openrouterClient.chat.completions.create(citationParams);

              const citations: Array<{
                type: "url";
                url: string;
                title: string;
              }> = [];

              const citationMessage = citationResponse.choices[0]?.message;
              if (citationMessage && citationMessage.annotations) {
                console.log(
                  "Processing citations:",
                  citationMessage.annotations,
                );
                const annotations = citationMessage.annotations as any[];
                for (const annotation of annotations) {
                  if (annotation.type === "url_citation") {
                    const urlCitation = annotation.url_citation;
                    const url = urlCitation?.url;
                    const title = urlCitation?.title || "Web Result";

                    if (
                      url &&
                      !citations.some((c) => c.type === "url" && c.url === url)
                    ) {
                      citations.push({ type: "url", url, title });
                    }
                  }
                }
              }

              console.log("Final citations from hybrid approach:", citations);

              await ctx.runMutation(
                internal.chatQueriesAndMutations.markMessageComplete,
                {
                  messageId: aiMessageId,
                  reasoningSummary: reasoningSummary.trim() || undefined,
                  citations: citations.length > 0 ? citations : undefined,
                },
              );
            } catch (citationError) {
              console.log(
                "Citation extraction failed, completing without citations:",
                citationError,
              );
              // Complete the message even if citation extraction fails
              await ctx.runMutation(
                internal.chatQueriesAndMutations.markMessageComplete,
                {
                  messageId: aiMessageId,
                  reasoningSummary: reasoningSummary.trim() || undefined,
                  citations: undefined,
                },
              );
            }

            return;
          }

          // Use streaming for non-web search requests
          const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
            {
              model: modelForApi,
              messages: [
                { role: "system", content: sysPrompt },
                ...(history as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
              ],
              stream: true,
            };

          if (Object.keys(reasoningParams).length > 0) {
            (params as any).reasoning = reasoningParams;
          }

          const responseStream =
            await openrouterClient.chat.completions.create(params);

          let reasoningSummary = "";
          const citations: Array<{
            type: "url";
            url: string;
            title: string;
          }> = [];

          for await (const chunk of responseStream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              await ctx.runMutation(
                internal.chatQueriesAndMutations.appendMessageContent,
                {
                  messageId: aiMessageId,
                  content: delta.content,
                },
              );
            }

            const reasoningDelta = (delta as any).reasoning;
            if (reasoningDelta) {
              reasoningSummary += reasoningDelta;
              await ctx.runMutation(
                internal.chatQueriesAndMutations.updateReasoningSummary,
                {
                  messageId: aiMessageId,
                  reasoningSummary: reasoningSummary,
                },
              );
            }

            // Handle final chunk with annotations
            if (chunk.choices[0]?.finish_reason === "stop") {
              const choice = chunk.choices[0] as any;
              const message = choice.message;

              // Extract annotations from the final message
              if (message && message.annotations) {
                const annotations = message.annotations;
                for (const annotation of annotations) {
                  if (annotation.type === "url_citation") {
                    const urlCitation = annotation.url_citation;
                    const url = urlCitation?.url;
                    const title = urlCitation?.title || "Web Result";

                    if (
                      url &&
                      !citations.some((c) => c.type === "url" && c.url === url)
                    ) {
                      citations.push({ type: "url", url, title });
                    }
                  }
                }
              }
            }
          }

          await ctx.runMutation(
            internal.chatQueriesAndMutations.markMessageComplete,
            {
              messageId: aiMessageId,
              reasoningSummary: reasoningSummary.trim() || undefined,
              citations: citations.length > 0 ? citations : undefined,
            },
          );
          return;
        }

        // Validate API key for OpenAI models
        if (!args.openaiApiKey) {
          throw new Error("OpenAI API key is required for this model");
        }

        // Create OpenAI client with user's API key
        const openaiClient = new OpenAI({
          apiKey: args.openaiApiKey,
        });

        // Create the streaming response using the Responses API
        const response = await openaiClient.responses.create({
          model: selectedModel,
          input: inputText, // Simple string input
          previous_response_id: conversation.lastResponseId || undefined,
          instructions: sysPrompt,
          tools: tools.length > 0 ? tools : undefined,
          include: tools.length > 0 ? ["file_search_call.results"] : undefined, // Include search results
          reasoning: isThinkingModel(selectedModel)
            ? {
                effort: thinkingIntensity,
                summary: "detailed",
              }
            : undefined,
          temperature: 1,
          top_p: 1,
          stream: true, // Enable streaming
        });

        // Handle streaming response
        let fullContent = "";
        let openaiResponseId = "";
        let reasoningSummary = "";
        const citations: Array<
          | {
              type: "file";
              fileId: string;
              fileName: string;
            }
          | {
              type: "url";
              url: string;
              title: string;
            }
        > = [];

        for await (const event of response) {
          try {
            if (event.type === "response.created") {
              openaiResponseId = event.response.id;
            } else if (event.type === "response.output_text.delta") {
              // Accumulate the content
              fullContent += event.delta;

              // Immediately append each delta to the database for real-time streaming
              await ctx.runMutation(
                internal.chatQueriesAndMutations.appendMessageContent,
                {
                  messageId: aiMessageId,
                  content: event.delta,
                },
              );
            } else if (event.type === "response.reasoning_summary_text.delta") {
              reasoningSummary += event.delta;

              // Stream reasoning summary updates in real-time
              await ctx.runMutation(
                internal.chatQueriesAndMutations.updateReasoningSummary,
                {
                  messageId: aiMessageId,
                  reasoningSummary: reasoningSummary,
                },
              );
            } else if (event.type === "response.reasoning_summary_text.done") {
              reasoningSummary += event.text;

              // Final reasoning summary update
              await ctx.runMutation(
                internal.chatQueriesAndMutations.updateReasoningSummary,
                {
                  messageId: aiMessageId,
                  reasoningSummary: reasoningSummary,
                },
              );
            } else if (event.type === "response.output_text.done") {
              // Handle file citations if present
              const outputItem = event as OutputItemWithAnnotations;
              if (outputItem && outputItem.annotations) {
                const annotations = outputItem.annotations;
                for (const annotation of annotations) {
                  if (annotation.type === "file_citation") {
                    const fileId = annotation.file_id;
                    const fileName = annotation.filename || "unknown";

                    // Add to citations array if not already present
                    if (
                      !citations.some(
                        (c) => c.type === "file" && c.fileId === fileId,
                      )
                    ) {
                      citations.push({
                        type: "file",
                        fileId,
                        fileName,
                      });
                    }

                    console.log(`File Citation: ${fileName} (${fileId})`);
                  } else if (annotation.type === "url_citation") {
                    const url = annotation.url;
                    const title = annotation.title || "Web Result";

                    // Add to citations array if not already present
                    if (
                      !citations.some((c) => c.type === "url" && c.url === url)
                    ) {
                      citations.push({
                        type: "url",
                        url,
                        title,
                      });
                    }

                    console.log(`URL Citation: ${title} (${url})`);
                  }
                }
              }
            } else if (event.type === "response.completed") {
              // Extract any final citations from the completed response
              if (event.response.output && event.response.output.length > 0) {
                for (const item of event.response.output as ResponseOutput[]) {
                  if (item.type === "message" && item.content) {
                    for (const content of item.content) {
                      if (
                        content.type === "output_text" &&
                        content.annotations
                      ) {
                        for (const annotation of content.annotations) {
                          if (annotation.type === "file_citation") {
                            const fileId = annotation.file_id;
                            const fileName = annotation.filename || "unknown";

                            if (
                              !citations.some(
                                (c) => c.type === "file" && c.fileId === fileId,
                              )
                            ) {
                              citations.push({
                                type: "file",
                                fileId,
                                fileName,
                              });
                            }
                          } else if (annotation.type === "url_citation") {
                            const url = annotation.url;
                            const title = annotation.title || "Web Result";

                            if (
                              !citations.some(
                                (c) => c.type === "url" && c.url === url,
                              )
                            ) {
                              citations.push({
                                type: "url",
                                url,
                                title,
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              // Mark the message as completed and add final data
              await ctx.runMutation(
                internal.chatQueriesAndMutations.markMessageComplete,
                {
                  messageId: aiMessageId,
                  openaiResponseId: openaiResponseId,
                  reasoningSummary: reasoningSummary.trim() || undefined,
                  citations: citations.length > 0 ? citations : undefined,
                },
              );

              // Update the conversation with the latest response ID
              await ctx.runMutation(
                internal.chatQueriesAndMutations.updateConversationResponseId,
                {
                  conversationId: args.conversationId,
                  responseId: openaiResponseId,
                },
              );

              console.log(
                `Streaming response completed for conversation ${args.conversationId}`,
              );
              break;
            }
          } catch (streamError) {
            console.error("Error processing stream event:", streamError);
            // Continue processing other events
          }
        }

        // Ensure we have some content, even if streaming failed partway
        if (!fullContent.trim()) {
          console.warn("No content generated in OpenAI response");
          await ctx.runMutation(
            internal.chatQueriesAndMutations.markMessageError,
            {
              messageId: aiMessageId,
              errorDetails: "No content was generated in the response.",
            },
          );
        }
      } catch (error) {
        console.error("Error during OpenAI response generation:", error);
        const errorMessage = getUserFriendlyErrorMessage(error);
        // Update the existing AI message with error status and content
        // instead of creating a new message
        await ctx.runMutation(
          internal.chatQueriesAndMutations.appendMessageContent,
          {
            messageId: aiMessageId,
            content:
              "Sorry, I encountered an error while generating a response.",
          },
        );
        await ctx.runMutation(
          internal.chatQueriesAndMutations.markMessageError,
          {
            messageId: aiMessageId,
            errorDetails: errorMessage,
          },
        );
      }
    } catch (error) {
      console.error("Error in generateAiResponse:", error);
      const errorMessage = getUserFriendlyErrorMessage(error);
      // This outer catch handles errors that occur before message creation
      // In this case, we should store a new error message
      await ctx.runMutation(internal.chatQueriesAndMutations.storeAiMessage, {
        conversationId: args.conversationId,
        content: "Sorry, I encountered an error while preparing the response.",
        status: "error",
        errorDetails: errorMessage,
      });
    }
  },
});

// Action to upload files and send a message using the Responses API with file search
export const uploadFileAndSendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(), // User's text message
    uploadedConvexFiles: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
      }),
    ),
    webSearchEnabled: v.optional(v.boolean()),
    model: v.optional(v.string()),
    thinkingIntensity: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    timezone: v.optional(v.string()),
    openaiApiKey: v.optional(v.string()),
    openrouterApiKey: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    errors: v.array(v.string()),
  }),
  handler: async (
    ctx: ActionCtx,
    args: {
      conversationId: Id<"conversations">;
      content: string;
      uploadedConvexFiles: Array<{
        storageId: Id<"_storage">;
        fileName: string;
      }>;
      webSearchEnabled?: boolean;
      model?: string;
      thinkingIntensity?: "low" | "medium" | "high";
      timezone?: string;
      openaiApiKey?: string;
      openrouterApiKey?: string;
    },
  ): Promise<{ success: boolean; errors: string[] }> => {
    const errors: string[] = [];

    // First, verify the user is authenticated
    const user = await getLoggedInUser(ctx);

    // Validate model if provided
    if (args.model) {
      if (!isSupportedModel(args.model)) {
        throw new Error(`Unsupported model: ${args.model}`);
      }

      // Validate thinking intensity is only provided for thinking models
      if (args.thinkingIntensity && !isThinkingModel(args.model)) {
        throw new Error(
          "Thinking intensity can only be set for thinking models",
        );
      }
    }

    const conversation: Doc<"conversations"> | null = await ctx.runQuery(
      internal.chatQueriesAndMutations.getConversation,
      {
        conversationId: args.conversationId,
        userId: user._id,
      },
    );

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    // Verify the conversation belongs to the authenticated user
    if (conversation.userId !== user._id) {
      throw new Error("Access denied: conversation does not belong to user");
    }

    const uploadedOpenAIFileIds: string[] = [];
    const originalFileNames: string[] = [];
    const vectorStoreFileIds: string[] = [];
    // Add storage mapping for file previews
    const uploadedFilesMapping: Array<{
      fileName: string;
      storageId: Id<"_storage">;
      fileType: string;
      fileSize: number;
    }> = [];

    // Validate maximum number of files
    if (args.uploadedConvexFiles.length > MAX_FILES) {
      throw new Error(
        `Too many files uploaded. Maximum allowed: ${MAX_FILES}, received: ${args.uploadedConvexFiles.length}`,
      );
    }

    // Validate API key if files need to be uploaded
    if (args.uploadedConvexFiles.length > 0 && !args.openaiApiKey) {
      throw new Error("OpenAI API key is required to upload files");
    }

    // Create OpenAI client with user's API key if needed
    const openaiClient = args.openaiApiKey
      ? new OpenAI({
          apiKey: args.openaiApiKey,
        })
      : null;

    // Create or get vector store for this conversation
    let vectorStoreId = conversation.vectorStoreId;
    if (!vectorStoreId && args.uploadedConvexFiles.length > 0 && openaiClient) {
      try {
        const vectorStore = await openaiClient.vectorStores.create({
          name: `conversation_${args.conversationId}`,
        });
        vectorStoreId = vectorStore.id;

        // Store vector store ID in conversation
        await ctx.runMutation(
          internal.chatQueriesAndMutations.updateConversationVectorStore,
          {
            conversationId: args.conversationId,
            vectorStoreId: vectorStoreId,
          },
        );

        // Keep local conversation object in sync to avoid false error reporting
        conversation.vectorStoreId = vectorStoreId;

        console.log(
          `Created vector store ${vectorStoreId} for conversation ${args.conversationId}`,
        );
      } catch (error) {
        console.error("Failed to create vector store:", error);
        errors.push("Failed to create vector store for file search");
      }
    }

    // Upload files to OpenAI and add to vector store
    for (const uploadedFile of args.uploadedConvexFiles) {
      // Validate file type
      const fileExtension = uploadedFile.fileName
        .split(".")
        .pop()
        ?.toLowerCase();
      if (!fileExtension || !isSupportedFileExtension(fileExtension)) {
        const errorMessage = `File ${uploadedFile.fileName} has unsupported type: ${fileExtension}. Skipping.`;
        console.warn(errorMessage);
        errors.push(errorMessage);
        continue;
      }

      const fileContent = await ctx.storage.get(uploadedFile.storageId);
      if (!fileContent) {
        const errorMessage = `File with Convex storage ID ${uploadedFile.storageId} not found. Skipping.`;
        console.warn(errorMessage);
        errors.push(errorMessage);
        continue;
      }

      // Validate file size
      const fileSize = fileContent.size;
      if (fileSize > MAX_FILE_SIZE) {
        const errorMessage = `File ${uploadedFile.fileName} is too large: ${fileSize} bytes (max: ${MAX_FILE_SIZE} bytes). Skipping.`;
        console.warn(errorMessage);
        errors.push(errorMessage);
        continue;
      }

      try {
        // Upload file to OpenAI Files API
        const fileForOpenAI = await OpenAI.toFile(
          fileContent,
          uploadedFile.fileName,
        );

        if (!openaiClient) {
          throw new Error("OpenAI client not available for file upload");
        }

        const openAIFile = await openaiClient.files.create({
          file: fileForOpenAI,
          purpose: "assistants", // Required for vector stores
        });

        uploadedOpenAIFileIds.push(openAIFile.id);
        originalFileNames.push(uploadedFile.fileName);

        console.log(
          `Uploaded file ${uploadedFile.fileName} to OpenAI with ID: ${openAIFile.id}`,
        );

        // Add file to vector store if we have one
        if (vectorStoreId && openaiClient) {
          try {
            await openaiClient.vectorStores.files.create(vectorStoreId, {
              file_id: openAIFile.id,
            });

            vectorStoreFileIds.push(openAIFile.id);
            console.log(
              `Added file ${openAIFile.id} to vector store ${vectorStoreId}`,
            );
          } catch (error) {
            console.error(
              `Failed to add file ${openAIFile.id} to vector store:`,
              error,
            );
            errors.push(
              `Failed to add file ${uploadedFile.fileName} to search index`,
            );
          }
        } else if (
          args.uploadedConvexFiles.length > 0 &&
          !conversation.vectorStoreId
        ) {
          // If we wanted a vector store but couldn't create one, note this as an error
          errors.push(
            `File ${uploadedFile.fileName} uploaded but not searchable due to vector store creation failure`,
          );
        }

        // Add storage mapping for file previews
        uploadedFilesMapping.push({
          fileName: uploadedFile.fileName,
          storageId: uploadedFile.storageId,
          fileType: getMimeType(uploadedFile.fileName, fileExtension),
          fileSize: fileSize,
        });
      } catch (error) {
        const errorMessage = `Failed to upload file ${uploadedFile.fileName} to OpenAI: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        errors.push(errorMessage);
        continue;
      }
    }

    if (
      uploadedOpenAIFileIds.length === 0 &&
      args.uploadedConvexFiles.length > 0
    ) {
      // Only throw error if ALL files failed to upload
      // Check if we have any errors for all files
      if (errors.length === args.uploadedConvexFiles.length) {
        throw new Error(
          "Failed to process any of the uploaded files for OpenAI. All files encountered errors.",
        );
      }
      // If we have partial failures, continue with empty file list but keep errors
      console.warn(
        "Some files failed to upload, continuing without files",
        errors,
      );
    }

    // Determine if this will be the first message before storing the current one
    const existingFirstMessage = await ctx.runQuery(
      internal.chatQueriesAndMutations.getFirstMessage,
      {
        conversationId: args.conversationId,
      },
    );
    const isFirstMessage = existingFirstMessage === null;

    // Insert the user's message into the Convex database with vector store info
    const messageId = await ctx.runMutation(
      internal.chatQueriesAndMutations.storeUserMessageWithVectorStore,
      {
        conversationId: args.conversationId,
        content: args.content,
        fileIds: uploadedOpenAIFileIds,
        uploadedFileNames: originalFileNames,
        uploadedFiles: uploadedFilesMapping,
        vectorStoreFileIds: vectorStoreFileIds,
        webSearchEnabled: args.webSearchEnabled,
        model: args.model,
        thinkingIntensity: args.thinkingIntensity,
        timezone: args.timezone,
      },
    );

    // Create file mappings for efficient citation lookups
    if (uploadedOpenAIFileIds.length > 0 && messageId) {
      const fileMappings = uploadedOpenAIFileIds.map((fileId, index) => ({
        openaiFileId: fileId,
        fileName: originalFileNames[index],
        storageId: uploadedFilesMapping[index]?.storageId,
        fileMimeType: uploadedFilesMapping[index]?.fileType,
        fileSize: uploadedFilesMapping[index]?.fileSize,
      }));

      await ctx.runMutation(
        internal.chatQueriesAndMutations.createUserFileMappings,
        {
          uploadedBy: user._id,
          conversationId: args.conversationId,
          messageId: messageId,
          fileMappings: fileMappings,
        },
      );
    }

    // Schedule the AI response action
    await ctx.scheduler.runAfter(0, internal.chat.generateAiResponse, {
      conversationId: args.conversationId,
      openaiApiKey: args.openaiApiKey,
      openrouterApiKey: args.openrouterApiKey,
    });

    // Schedule title generation if this was the first user message with text content
    if (isFirstMessage && args.content.trim() !== "") {
      await ctx.scheduler.runAfter(
        5000,
        internal.chat.generateConversationTitleAction,
        {
          conversationId: args.conversationId,
          openaiApiKey: args.openaiApiKey,
        },
      );
    }
    return { success: true, errors };
  },
});

// Internal action to generate conversation title using Responses API
export const generateConversationTitleAction = internalAction({
  args: {
    conversationId: v.id("conversations"),
    openaiApiKey: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    args: {
      conversationId: Id<"conversations">;
      openaiApiKey?: string;
    },
  ): Promise<null> => {
    try {
      // Fetch the first message in the conversation
      const firstMessage = await ctx.runQuery(
        internal.chatQueriesAndMutations.getFirstMessage,
        {
          conversationId: args.conversationId,
        },
      );

      if (
        !firstMessage ||
        (!firstMessage.content?.trim() &&
          !firstMessage.uploadedFileNames?.length)
      ) {
        console.warn(
          `No first message with content or files found for conversation ${args.conversationId}, cannot generate title.`,
        );
        return null;
      }

      let promptContent = `First message: "${firstMessage.content || ""}"`;
      if (
        firstMessage.uploadedFileNames &&
        firstMessage.uploadedFileNames.length > 0
      ) {
        const fileNamesString = firstMessage.uploadedFileNames.join(", ");
        promptContent += `\nFiles attached: [${fileNamesString}]`;
      }

      const prompt = `Create a concise and descriptive title (under 8 words) for a chat conversation based on the user's *first message* and any attached files. The title should capture the main topic or intent, suitable for display in a chat list. Avoid generic phrases like "New chat".

Examples:
User message: "Why is the bible in English?"
Title: Bible's Translation to English

User message: "Help me fix this merge conflict"
Title: Fix Merge Conflict

User message: "What are the requirements for setting up a business in USA?"
Title: USA Business Setup Requirements

User message: "Hi"
Title: Greetings Exchanged

User message: "Review this document." Files attached: [project_proposal.docx]
Title: Review Project Proposal

${promptContent}

Title:`;

      // Use a default API key from environment for title generation if user key not provided
      const apiKey = args.openaiApiKey || process.env.CONVEX_OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("No OpenAI API key available for title generation");
        return null;
      }

      const openaiClient = new OpenAI({
        apiKey: apiKey,
      });

      const response = await openaiClient.responses.create({
        model: "gpt-4.1-nano",
        input: [{ role: "user", content: prompt }], // Use input array
        temperature: 0.5, // Adjust temperature for desired creativity/focus
      });

      // Access the output text using the helper
      const summary = response.output_text?.trim();

      if (summary && summary.length > 0) {
        // Update the conversation name with the generated summary using the internal mutation
        await ctx.runMutation(
          internal.chatQueriesAndMutations.updateConversationName,
          {
            conversationId: args.conversationId,
            newName: summary,
          },
        );
        console.log(
          `Generated title for conversation ${args.conversationId}: "${summary}"`,
        );
      } else {
        console.warn(
          `Failed to generate summary for conversation ${args.conversationId}: OpenAI returned no content.`,
        );
      }
    } catch (error) {
      console.error(
        `Error generating conversation title for conversation ${args.conversationId}:`,
        error,
      );
    }

    return null;
  },
});
