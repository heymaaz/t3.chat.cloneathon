import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  conversations: defineTable({
    userId: v.id("users"),
    name: v.string(),
    lastResponseId: v.optional(v.string()), // OpenAI Response ID for multi-turn conversations
    vectorStoreId: v.optional(v.string()), // OpenAI Vector Store ID for file search
    updatedTime: v.optional(v.number()), // Track last activity time for sorting
    // We can add a title or other metadata later if needed
  })
    .index("by_userId", ["userId"])
    .index("by_lastResponseId", ["lastResponseId"])
    .index("by_userId_and_updatedTime", ["userId", "updatedTime"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    author: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.optional(
      v.union(v.literal("typing"), v.literal("completed"), v.literal("error")),
    ),
    fileIds: v.optional(v.array(v.string())), // OpenAI File IDs
    uploadedFileNames: v.optional(v.array(v.string())),
    // Add storage mapping for file previews
    uploadedFiles: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          storageId: v.id("_storage"),
          fileType: v.string(), // MIME type
          fileSize: v.number(),
        }),
      ),
    ),
    openaiResponseId: v.optional(v.string()), // Store the OpenAI response ID for assistant messages
    vectorStoreFileIds: v.optional(v.array(v.string())), // Track files added to vector store
    webSearchEnabled: v.optional(v.boolean()),
    model: v.optional(v.string()), // Selected AI model
    thinkingIntensity: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ), // Thinking intensity for reasoning models
    citations: v.optional(
      v.array(
        v.union(
          v.object({
            type: v.literal("file"),
            fileId: v.string(), // OpenAI file ID
            fileName: v.string(), // Original filename
          }),
          v.object({
            type: v.literal("url"),
            url: v.string(),
            title: v.string(),
          }),
        ),
      ),
    ), // File and URL citations for AI responses
    reasoningSummary: v.optional(v.string()),
    // Store the sender's timezone for each message
    timezone: v.optional(v.string()),
  }).index("by_conversationId", ["conversationId"]),

  // New table for efficient file citation lookups
  fileMessageMappings: defineTable({
    openaiFileId: v.string(), // OpenAI File ID used in citations
    fileName: v.string(),
    fileType: v.union(v.literal("user_upload")), // File uploaded by user

    // For user uploads: store user who uploaded and Convex storage reference
    uploadedBy: v.optional(v.id("users")), // User who uploaded (required for user_upload)
    storageId: v.optional(v.id("_storage")), // Convex storage ID (for user_upload)

    // Optional: Context for user uploads (which conversation/message first used this file)
    firstUsedInConversationId: v.optional(v.id("conversations")),
    firstUsedInMessageId: v.optional(v.id("messages")),

    // Additional metadata
    fileMimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    uploadedAt: v.number(), // When the file was uploaded
  })
    .index("by_openaiFileId", ["openaiFileId"]) // Primary lookup by file ID
    .index("by_uploadedBy", ["uploadedBy"]) // Find files uploaded by user
    .index("by_fileType", ["fileType"]) // Find files by type
    .index("by_conversationId", ["firstUsedInConversationId"]), // Optional: context lookup
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
