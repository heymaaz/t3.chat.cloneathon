// This file does NOT use "use node" and contains queries and mutations.
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api"; // For calling generateAiResponse action

// Constants
export const MAX_MESSAGE_SIZE = 50 * 1024; // 50KB

// Validators for documents returned by queries and mutations
const conversationDoc = v.object({
  _id: v.id("conversations"),
  _creationTime: v.number(),
  userId: v.id("users"),
  name: v.string(),
  lastResponseId: v.optional(v.string()),
  vectorStoreId: v.optional(v.string()),
  updatedTime: v.optional(v.number()),
});

const messageDoc = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  author: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  status: v.optional(
    v.union(v.literal("typing"), v.literal("completed"), v.literal("error")),
  ),
  fileIds: v.optional(v.array(v.string())),
  uploadedFileNames: v.optional(v.array(v.string())),
  uploadedFiles: v.optional(
    v.array(
      v.object({
        fileName: v.string(),
        storageId: v.id("_storage"),
        fileType: v.string(),
        fileSize: v.number(),
      }),
    ),
  ),
  openaiResponseId: v.optional(v.string()),
  vectorStoreFileIds: v.optional(v.array(v.string())),
  webSearchEnabled: v.optional(v.boolean()),
  model: v.optional(v.string()),
  thinkingIntensity: v.optional(
    v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  ),
  citations: v.optional(
    v.array(
      v.union(
        v.object({
          type: v.literal("file"),
          fileId: v.string(),
          fileName: v.string(),
        }),
        v.object({
          type: v.literal("url"),
          url: v.string(),
          title: v.string(),
        }),
      ),
    ),
  ),
  reasoningSummary: v.optional(v.string()),
  timezone: v.optional(v.string()),
});

const userDoc = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
});

// Helper to get the logged-in user across different function types
// This function should be called at the beginning of every public function
// to ensure only authenticated users can access the API
export async function getLoggedInUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated");
  }

  // Check the context type to determine how to fetch the user document
  if ("db" in ctx) {
    // Context is QueryCtx or MutationCtx
    const user: Doc<"users"> | null = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  } else {
    // Context is ActionCtx
    // Call an internal query to fetch the user by ID from an action
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.chatQueriesAndMutations.getUserById,
      { userId },
    );
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
}

// Queries
export const listConversations = query({
  args: {},
  returns: v.array(conversationDoc),
  handler: async (ctx: QueryCtx): Promise<Doc<"conversations">[]> => {
    const user: Doc<"users"> = await getLoggedInUser(ctx);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by updatedTime if available, otherwise fall back to _creationTime
    // Both in descending order (most recent first)
    return conversations.sort((a, b) => {
      const timeA = a.updatedTime ?? a._creationTime;
      const timeB = b.updatedTime ?? b._creationTime;
      return timeB - timeA;
    });
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(messageDoc),
  handler: async (
    ctx: QueryCtx,
    args: { conversationId: Id<"conversations"> },
  ): Promise<Doc<"messages">[]> => {
    const user = await getLoggedInUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      console.error(
        "Someone is trying to access a conversation they don't own",
        conversation,
        user,
      );
      throw new Error("Not found");
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
  },
});

export const getRecentMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  returns: v.array(messageDoc),
  handler: async (
    ctx: QueryCtx,
    args: { conversationId: Id<"conversations">; userId: Id<"users"> },
  ): Promise<Doc<"messages">[]> => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== args.userId) {
      console.error(
        "Someone is trying to access a conversation they don't own",
        conversation,
        args.userId,
      );
      throw new Error("Not found");
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(20);
  },
});

// Mutations
export const createConversation = mutation({
  args: {},
  returns: v.id("conversations"),
  handler: async (ctx: MutationCtx): Promise<Id<"conversations">> => {
    const user: Doc<"users"> = await getLoggedInUser(ctx);

    // Create a new conversation with the user ID and a default name
    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      name: "New Chat", // Set initial name to "New Chat"
    });

    return conversationId;
  },
});

export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    webSearchEnabled: v.optional(v.boolean()),
    model: v.optional(v.string()),
    thinkingIntensity: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    timezone: v.optional(v.string()),
    openaiApiKey: v.optional(v.string()),
    openrouterApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (
    ctx: ActionCtx,
    args: {
      conversationId: Id<"conversations">;
      content: string;
      webSearchEnabled?: boolean;
      model?: string;
      thinkingIntensity?: "low" | "medium" | "high";
      timezone?: string;
      openaiApiKey?: string;
      openrouterApiKey?: string;
    },
  ): Promise<null> => {
    const user: Doc<"users"> = await getLoggedInUser(ctx);
    const conversation: Doc<"conversations"> | null = await ctx.runQuery(
      internal.chatQueriesAndMutations.getConversation,
      {
        conversationId: args.conversationId,
        userId: user._id,
      },
    );

    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    // Validate model if provided
    if (args.model) {
      const { isSupportedModel, isThinkingModel } = await import("./constants");
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

    // Check if this is the first message in the conversation using getFirstMessage
    const firstMessage = await ctx.runQuery(
      internal.chatQueriesAndMutations.getFirstMessage,
      {
        conversationId: args.conversationId,
      },
    );

    const isFirstMessage = firstMessage === null;

    // Insert the user's message into the Convex database using runMutation
    await ctx.runMutation(internal.chatQueriesAndMutations.storeUserMessage, {
      conversationId: args.conversationId,
      content: args.content,
      webSearchEnabled: args.webSearchEnabled,
      model: args.model,
      thinkingIntensity: args.thinkingIntensity,
      timezone: args.timezone,
    });

    // Schedule the AI response action
    await ctx.scheduler.runAfter(0, internal.chat.generateAiResponse, {
      conversationId: args.conversationId,
      openaiApiKey: args.openaiApiKey,
      openrouterApiKey: args.openrouterApiKey,
    });

    // If this is the first message, schedule the title generation action
    if (isFirstMessage) {
      // Schedule the title generation shortly after to allow the message and AI response to be processed
      // A delay might be needed depending on the AI response time
      await ctx.scheduler.runAfter(
        5000,
        internal.chat.generateConversationTitleAction,
        {
          // 5 second delay, adjust as needed
          conversationId: args.conversationId,
          openaiApiKey: args.openaiApiKey,
        },
      );
    }

    return null;
  },
});

// Mutation to delete a conversation and its messages
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { conversationId: Id<"conversations"> },
  ): Promise<null> => {
    const user: Doc<"users"> = await getLoggedInUser(ctx);
    const conversation: Doc<"conversations"> | null = await ctx.db.get(
      args.conversationId,
    );
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }
    // Delete all messages in this conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    // Delete the conversation itself
    await ctx.db.delete(args.conversationId);
    return null;
  },
});

export const storeAiMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    status: v.optional(
      v.union(v.literal("typing"), v.literal("completed"), v.literal("error")),
    ),
    openaiResponseId: v.optional(v.string()),
    reasoningSummary: v.optional(v.string()),
    citations: v.optional(
      v.array(
        v.union(
          v.object({
            type: v.literal("file"),
            fileId: v.string(),
            fileName: v.string(),
          }),
          v.object({
            type: v.literal("url"),
            url: v.string(),
            title: v.string(),
          }),
        ),
      ),
    ),
    timezone: v.optional(v.string()),
  },
  returns: v.id("messages"),
  handler: async (
    ctx: MutationCtx,
    args: {
      conversationId: Id<"conversations">;
      content: string;
      status?: "typing" | "completed" | "error";
      openaiResponseId?: string;
      citations?: Array<
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
      >;
      reasoningSummary?: string;
      timezone?: string;
    },
  ): Promise<Id<"messages">> => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      author: "assistant" as const,
      content: args.content,
      status: args.status,
      openaiResponseId: args.openaiResponseId,
      reasoningSummary: args.reasoningSummary,
      citations: args.citations,
      timezone: args.timezone,
    });

    // Update conversation activity time only for completed messages
    // Don't update for "typing" status to avoid too frequent updates
    if (args.status !== "typing") {
      await ctx.db.patch(args.conversationId, {
        updatedTime: Date.now(),
      });
    }

    return messageId;
  },
});

// New internal query to get a conversation by ID
export const getConversation = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    userId: v.optional(v.id("users")),
  },
  returns: v.union(conversationDoc, v.null()),
  handler: async (
    ctx,
    args: { conversationId: Id<"conversations">; userId?: Id<"users"> },
  ): Promise<Doc<"conversations"> | null> => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }
    if (args.userId && conversation.userId !== args.userId) {
      console.error(
        "Someone is trying to access a conversation they don't own",
        conversation,
        args.userId,
      );
      throw new Error("Not found");
    }
    return conversation;
  },
});

// New internal mutation to update a conversation with the OpenAI response ID
export const updateConversationResponseId = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    responseId: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { conversationId: Id<"conversations">; responseId: string },
  ): Promise<null> => {
    // Check if conversation exists before updating
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      console.warn(
        `Conversation ${args.conversationId} not found when updating response ID`,
      );
      return null;
    }

    await ctx.db.patch(args.conversationId, {
      lastResponseId: args.responseId,
    });
    return null;
  },
});

// New internal query to get a user by ID (callable from actions)
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(userDoc, v.null()),
  handler: async (
    ctx: QueryCtx,
    args: { userId: Id<"users"> },
  ): Promise<Doc<"users"> | null> => {
    return await ctx.db.get(args.userId);
  },
});

// New internal mutation to store user messages (callable from actions)
export const storeUserMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    fileIds: v.optional(v.array(v.string())),
    uploadedFileNames: v.optional(v.array(v.string())),
    timezone: v.optional(v.string()),
    webSearchEnabled: v.optional(v.boolean()),
    model: v.optional(v.string()),
    thinkingIntensity: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: {
      conversationId: Id<"conversations">;
      content: string;
      fileIds?: string[];
      uploadedFileNames?: string[];
      timezone?: string;
      webSearchEnabled?: boolean;
      model?: string;
      thinkingIntensity?: "low" | "medium" | "high";
    },
  ): Promise<null> => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      author: "user" as const,
      content: args.content,
      fileIds: args.fileIds,
      uploadedFileNames: args.uploadedFileNames,
      timezone: args.timezone,
      webSearchEnabled: args.webSearchEnabled,
      model: args.model,
      thinkingIntensity: args.thinkingIntensity,
    });

    // Update conversation activity time
    await ctx.db.patch(args.conversationId, {
      updatedTime: Date.now(),
    });

    return null;
  },
});

// New internal mutation to append content to a message for streaming
export const appendMessageContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { messageId: Id<"messages">; content: string },
  ): Promise<null> => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      console.warn(
        `Message with ID ${args.messageId} not found for appending.`,
      );
      return null;
    }

    // Add safety check for message size
    const newContent = message.content + args.content;
    if (newContent.length > MAX_MESSAGE_SIZE) {
      console.warn(
        `Message ${args.messageId} would exceed size limit (${newContent.length} > ${MAX_MESSAGE_SIZE}), truncating...`,
      );
      // Truncate the content to fit within the limit
      const remainingSpace = MAX_MESSAGE_SIZE - message.content.length;
      if (remainingSpace <= 0) {
        // Message is already at or over limit, don't append
        return null;
      }
      await ctx.db.patch(args.messageId, {
        content: message.content + args.content.substring(0, remainingSpace),
      });
    } else {
      await ctx.db.patch(args.messageId, {
        content: newContent,
      });
    }
    return null;
  },
});

// New internal mutation to mark a message as complete after streaming
export const markMessageComplete = internalMutation({
  args: {
    messageId: v.id("messages"),
    openaiResponseId: v.optional(v.string()),
    reasoningSummary: v.optional(v.string()),
    citations: v.optional(
      v.array(
        v.union(
          v.object({
            type: v.literal("file"),
            fileId: v.string(),
            fileName: v.string(),
          }),
          v.object({
            type: v.literal("url"),
            url: v.string(),
            title: v.string(),
          }),
        ),
      ),
    ),
    timezone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: {
      messageId: Id<"messages">;
      openaiResponseId?: string;
      reasoningSummary?: string;
      citations?: Array<
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
      >;
      timezone?: string;
    },
  ): Promise<null> => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      console.warn(
        `Message with ID ${args.messageId} not found for marking as complete.`,
      );
      return null;
    }

    // Build update object with status and optional fields
    const updateData: {
      status: "completed";
      openaiResponseId?: string;
      reasoningSummary?: string;
      citations?: Array<
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
      >;
    } = {
      status: "completed",
    };
    if (args.openaiResponseId !== undefined) {
      updateData.openaiResponseId = args.openaiResponseId;
    }
    if (args.reasoningSummary !== undefined) {
      updateData.reasoningSummary = args.reasoningSummary;
    }
    if (args.citations !== undefined) {
      updateData.citations = args.citations;
    }

    await ctx.db.patch(args.messageId, updateData);
    return null;
  },
});

// New internal mutation to mark a message with an error status
export const markMessageError = internalMutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { messageId: Id<"messages"> },
  ): Promise<null> => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      console.warn(
        `Message with ID ${args.messageId} not found for marking as error.`,
      );
      return null;
    }
    await ctx.db.patch(args.messageId, {
      status: "error",
    });
    return null;
  },
});

// New internal mutation to update reasoning summary in real-time
export const updateReasoningSummary = internalMutation({
  args: {
    messageId: v.id("messages"),
    reasoningSummary: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { messageId: Id<"messages">; reasoningSummary: string },
  ): Promise<null> => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      console.warn(
        `Message with ID ${args.messageId} not found for updating reasoning summary.`,
      );
      return null;
    }
    await ctx.db.patch(args.messageId, {
      reasoningSummary: args.reasoningSummary,
    });
    return null;
  },
});

// New internal query to get the first message of a conversation
export const getFirstMessage = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.union(messageDoc, v.null()),
  handler: async (
    ctx: QueryCtx,
    args: { conversationId: Id<"conversations"> },
  ): Promise<Doc<"messages"> | null> => {
    // Query messages for the conversation, ordered by creation time ascending, and take the first one
    const message = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc") // Get the first message (oldest)
      .first(); // Get only the first result

    return message;
  },
});

// New internal mutation to update a conversation's name
export const updateConversationName = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    newName: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { conversationId: Id<"conversations">; newName: string },
  ): Promise<null> => {
    // Get the conversation document by ID
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      // Throw an error if the conversation doesn't exist
      throw new Error(`Conversation not found with ID: ${args.conversationId}`);
    }

    // Update the conversation's name
    await ctx.db.patch(args.conversationId, { name: args.newName });

    return null;
  },
});

// New mutation to store a file in Convex storage
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx: MutationCtx): Promise<string> => {
    await getLoggedInUser(ctx); // Just check authentication
    return await ctx.storage.generateUploadUrl();
  },
});

// New internal query to get the last user message from a conversation
export const getLastUserMessage = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.union(messageDoc, v.null()),
  handler: async (
    ctx: QueryCtx,
    args: { conversationId: Id<"conversations"> },
  ): Promise<Doc<"messages"> | null> => {
    // Get the most recent user message from the conversation
    const message = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) => q.eq(q.field("author"), "user"))
      .order("desc") // Get the most recent message
      .first(); // Get only the first result

    return message;
  },
});

// New query to get conversation's model settings from the last user message
export const getConversationModelSettings = query({
  args: { conversationId: v.id("conversations") },
  returns: v.object({
    model: v.union(v.string(), v.null()),
    thinkingIntensity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.null(),
    ),
    webSearchEnabled: v.union(v.boolean(), v.null()),
  }),
  handler: async (
    ctx: QueryCtx,
    args: { conversationId: Id<"conversations"> },
  ): Promise<{
    model: string | null;
    thinkingIntensity: "low" | "medium" | "high" | null;
    webSearchEnabled: boolean | null;
  }> => {
    const user = await getLoggedInUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Not found");
    }

    // Get the most recent user message to extract model settings
    const lastUserMessage = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) => q.eq(q.field("author"), "user"))
      .order("desc")
      .first();

    return {
      model: lastUserMessage?.model || null,
      thinkingIntensity: lastUserMessage?.thinkingIntensity || null,
      webSearchEnabled: lastUserMessage?.webSearchEnabled || null,
    };
  },
});

// New internal mutation to update conversation with vector store ID
export const updateConversationVectorStore = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    vectorStoreId: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx: MutationCtx,
    args: { conversationId: Id<"conversations">; vectorStoreId: string },
  ): Promise<null> => {
    await ctx.db.patch(args.conversationId, {
      vectorStoreId: args.vectorStoreId,
    });
    return null;
  },
});

// Updated storeUserMessage to include vector store file IDs
export const storeUserMessageWithVectorStore = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    fileIds: v.optional(v.array(v.string())),
    uploadedFileNames: v.optional(v.array(v.string())),
    uploadedFiles: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          storageId: v.id("_storage"),
          fileType: v.string(),
          fileSize: v.number(),
        }),
      ),
    ),
    vectorStoreFileIds: v.optional(v.array(v.string())),
    timezone: v.optional(v.string()),
    webSearchEnabled: v.optional(v.boolean()),
    model: v.optional(v.string()),
    thinkingIntensity: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
  },
  returns: v.id("messages"),
  handler: async (
    ctx: MutationCtx,
    args: {
      conversationId: Id<"conversations">;
      content: string;
      fileIds?: string[];
      uploadedFileNames?: string[];
      uploadedFiles?: Array<{
        fileName: string;
        storageId: Id<"_storage">;
        fileType: string;
        fileSize: number;
      }>;
      vectorStoreFileIds?: string[];
      timezone?: string;
      webSearchEnabled?: boolean;
      model?: string;
      thinkingIntensity?: "low" | "medium" | "high";
    },
  ): Promise<Id<"messages">> => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      author: "user" as const,
      content: args.content,
      fileIds: args.fileIds,
      uploadedFileNames: args.uploadedFileNames,
      uploadedFiles: args.uploadedFiles,
      vectorStoreFileIds: args.vectorStoreFileIds,
      timezone: args.timezone,
      webSearchEnabled: args.webSearchEnabled,
      model: args.model,
      thinkingIntensity: args.thinkingIntensity,
    });

    // Update conversation activity time
    await ctx.db.patch(args.conversationId, {
      updatedTime: Date.now(),
    });

    return messageId;
  },
});

// New internal query to get a message by ID (callable from actions)
export const getMessageById = internalQuery({
  args: { messageId: v.id("messages") },
  returns: v.union(messageDoc, v.null()),
  handler: async (
    ctx: QueryCtx,
    args: { messageId: Id<"messages"> },
  ): Promise<Doc<"messages"> | null> => {
    return await ctx.db.get(args.messageId);
  },
});

// New internal mutation to create file mappings for user uploads
export const createUserFileMapping = internalMutation({
  args: {
    openaiFileId: v.string(),
    fileName: v.string(),
    uploadedBy: v.id("users"),
    storageId: v.id("_storage"),
    fileMimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    // Optional context: which conversation/message first used this file
    firstUsedInConversationId: v.optional(v.id("conversations")),
    firstUsedInMessageId: v.optional(v.id("messages")),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      openaiFileId: string;
      fileName: string;
      uploadedBy: Id<"users">;
      storageId: Id<"_storage">;
      fileMimeType?: string;
      fileSize?: number;
      firstUsedInConversationId?: Id<"conversations">;
      firstUsedInMessageId?: Id<"messages">;
    },
  ): Promise<null> => {
    // Check if mapping already exists (avoid duplicates)
    const existingMapping = await ctx.db
      .query("fileMessageMappings")
      .withIndex("by_openaiFileId", (q) =>
        q.eq("openaiFileId", args.openaiFileId),
      )
      .unique();

    if (!existingMapping) {
      await ctx.db.insert("fileMessageMappings", {
        openaiFileId: args.openaiFileId,
        fileName: args.fileName,
        fileType: "user_upload",
        uploadedBy: args.uploadedBy,
        storageId: args.storageId,
        fileMimeType: args.fileMimeType,
        fileSize: args.fileSize,
        firstUsedInConversationId: args.firstUsedInConversationId,
        firstUsedInMessageId: args.firstUsedInMessageId,
        uploadedAt: Date.now(),
      });
    }

    return null;
  },
});

// Batch version for multiple files
export const createUserFileMappings = internalMutation({
  args: {
    uploadedBy: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.id("messages")),
    fileMappings: v.array(
      v.object({
        openaiFileId: v.string(),
        fileName: v.string(),
        storageId: v.id("_storage"),
        fileMimeType: v.optional(v.string()),
        fileSize: v.optional(v.number()),
      }),
    ),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      uploadedBy: Id<"users">;
      conversationId?: Id<"conversations">;
      messageId?: Id<"messages">;
      fileMappings: Array<{
        openaiFileId: string;
        fileName: string;
        storageId: Id<"_storage">;
        fileMimeType?: string;
        fileSize?: number;
      }>;
    },
  ): Promise<null> => {
    for (const fileMapping of args.fileMappings) {
      await ctx.runMutation(
        internal.chatQueriesAndMutations.createUserFileMapping,
        {
          openaiFileId: fileMapping.openaiFileId,
          fileName: fileMapping.fileName,
          uploadedBy: args.uploadedBy,
          storageId: fileMapping.storageId,
          fileMimeType: fileMapping.fileMimeType,
          fileSize: fileMapping.fileSize,
          firstUsedInConversationId: args.conversationId,
          firstUsedInMessageId: args.messageId,
        },
      );
    }

    return null;
  },
});

// Updated efficient file lookup function using the new table
export const findFileByOpenAIId = query({
  args: {
    openaiFileId: v.string(),
  },
  returns: v.union(
    v.object({
      fileName: v.string(),
      fileType: v.union(v.literal("user_upload")),
      storageId: v.optional(v.id("_storage")),
      uploadedBy: v.optional(v.id("users")),
      fileMimeType: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      firstUsedInConversationId: v.optional(v.id("conversations")),
      firstUsedInMessageId: v.optional(v.id("messages")),
    }),
    v.null(),
  ),
  handler: async (ctx: QueryCtx, args: { openaiFileId: string }) => {
    const user = await getLoggedInUser(ctx);

    // Efficient lookup using the dedicated index
    const fileMapping = await ctx.db
      .query("fileMessageMappings")
      .withIndex("by_openaiFileId", (q) =>
        q.eq("openaiFileId", args.openaiFileId),
      )
      .unique();

    if (!fileMapping) {
      return null;
    }

    // Check access based on file type
    if (fileMapping.fileType === "user_upload") {
      // User must be the one who uploaded the file
      if (fileMapping.uploadedBy !== user._id) {
        throw new Error("Access denied: file was not uploaded by current user");
      }
    }

    return {
      fileName: fileMapping.fileName,
      fileType: fileMapping.fileType,
      storageId: fileMapping.storageId,
      uploadedBy: fileMapping.uploadedBy,
      fileMimeType: fileMapping.fileMimeType,
      fileSize: fileMapping.fileSize,
      firstUsedInConversationId: fileMapping.firstUsedInConversationId,
      firstUsedInMessageId: fileMapping.firstUsedInMessageId,
    };
  },
});

// Helper function to find user message by OpenAI file ID - extracted for testing
export async function findUserMessageByFileIdImpl(
  ctx: QueryCtx,
  args: { conversationId: Id<"conversations">; openaiFileId: string },
): Promise<{ messageId: Id<"messages">; fileName: string } | null> {
  const user = await getLoggedInUser(ctx);

  // Verify user has access to this conversation
  const conversation = await ctx.db.get(args.conversationId);
  if (!conversation || conversation.userId !== user._id) {
    throw new Error("Access denied: conversation does not belong to user");
  }

  // Use the new efficient lookup method
  const fileMapping = await ctx.db
    .query("fileMessageMappings")
    .withIndex("by_openaiFileId", (q) =>
      q.eq("openaiFileId", args.openaiFileId),
    )
    .unique();

  if (!fileMapping) {
    return null;
  }

  // Ensure the file belongs to the requested conversation
  if (
    fileMapping.firstUsedInConversationId &&
    fileMapping.firstUsedInConversationId !== args.conversationId
  ) {
    return null;
  }

  // Check if file was used in this conversation and user has access
  if (fileMapping.fileType === "user_upload") {
    // User must be the one who uploaded the file
    if (fileMapping.uploadedBy !== user._id) {
      throw new Error("Access denied: file was not uploaded by current user");
    }
  }

  // Return the message ID where this file was first used (for backward compatibility)
  if (fileMapping.firstUsedInMessageId) {
    return {
      messageId: fileMapping.firstUsedInMessageId,
      fileName: fileMapping.fileName,
    };
  }

  return null;
}

// Keep the original function for backward compatibility, but use the new efficient implementation
export const findUserMessageByFileId = query({
  args: {
    conversationId: v.id("conversations"),
    openaiFileId: v.string(),
  },
  returns: v.union(
    v.object({
      messageId: v.id("messages"),
      fileName: v.string(),
    }),
    v.null(),
  ),
  handler: findUserMessageByFileIdImpl,
});
