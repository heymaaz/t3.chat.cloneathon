import { action } from "./_generated/server";
import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { getLoggedInUser } from "./chatQueriesAndMutations";
import { internal } from "./_generated/api";

// Return type for the file preview action
type FilePreviewResult = {
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadUrl: string | null;
  content: string | null;
} | null;

// Action to get file content for preview
export const getFileForPreview = action({
  args: {
    messageId: v.id("messages"),
    fileName: v.string(),
  },
  returns: v.union(
    v.object({
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      downloadUrl: v.union(v.string(), v.null()),
      content: v.union(v.string(), v.null()), // For text files
    }),
    v.null(),
  ),
  handler: async (
    ctx: ActionCtx,
    args: { messageId: Id<"messages">; fileName: string },
  ): Promise<FilePreviewResult> => {
    const user = await getLoggedInUser(ctx);

    // Get the message to ensure user has access
    const message: Doc<"messages"> | null = await ctx.runQuery(
      internal.chatQueriesAndMutations.getMessageById,
      {
        messageId: args.messageId,
      },
    );

    if (!message) {
      throw new Error("Message not found");
    }

    // Get the conversation to check ownership
    const conversation = await ctx.runQuery(
      internal.chatQueriesAndMutations.getConversation,
      {
        conversationId: message.conversationId,
        userId: user._id,
      },
    );

    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Access denied: conversation does not belong to user");
    }

    // Find the file in the uploaded files mapping
    const uploadedFile = message.uploadedFiles?.find(
      (file: {
        fileName: string;
        storageId: Id<"_storage">;
        fileType: string;
        fileSize: number;
      }) => file.fileName === args.fileName,
    );

    if (!uploadedFile) {
      throw new Error("File not found in message");
    }

    // Get the download URL from Convex storage
    const downloadUrl = await ctx.storage.getUrl(uploadedFile.storageId);

    // For text files, get the actual content
    let content: string | null = null;
    if (
      uploadedFile.fileType === "text/plain" ||
      uploadedFile.fileName.toLowerCase().endsWith(".txt")
    ) {
      try {
        const blob = await ctx.storage.get(uploadedFile.storageId);
        if (blob) {
          content = await blob.text();
        }
      } catch (error) {
        console.error("Failed to read file content:", error);
        // Don't throw error, just leave content as null
      }
    }

    return {
      fileName: uploadedFile.fileName,
      fileType: uploadedFile.fileType,
      fileSize: uploadedFile.fileSize,
      downloadUrl: downloadUrl,
      content: content,
    };
  },
});
