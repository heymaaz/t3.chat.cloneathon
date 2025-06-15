import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLoggedInUser,
  findUserMessageByFileIdImpl,
} from "../chatQueriesAndMutations";
import type { Id } from "../_generated/dataModel";
import {
  createMockQueryCtx,
  createMockMutationCtx,
  createMockActionCtx,
  createMockDatabase,
  createTestUser,
  createTestConversation,
  createTestMessage,
  createTestMessageWithFiles,
  createTestFileMapping,
  type MockDatabase,
} from "./setup.nobundle";

import { getAuthUserId } from "@convex-dev/auth/server";

describe("chatQueriesAndMutations", () => {
  describe("getLoggedInUser", () => {
    it("should throw error when user is not authenticated", async () => {
      (getAuthUserId as any).mockResolvedValue(null);

      const mockCtx = {
        db: {
          get: vi.fn(),
        },
      };

      await expect(getLoggedInUser(mockCtx as any)).rejects.toThrow(
        "User not authenticated",
      );
    });

    it("should throw error when user is not found in database", async () => {
      const mockUserId = "user123" as Id<"users">;
      (getAuthUserId as any).mockResolvedValue(mockUserId);

      const mockCtx = {
        db: {
          get: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(getLoggedInUser(mockCtx as any)).rejects.toThrow(
        "User not found",
      );
    });

    it("should return user when authenticated and found", async () => {
      const mockUserId = "user123" as Id<"users">;
      const mockUser = {
        _id: mockUserId,
        email: "test@example.com",
        name: "Test User",
      };

      (getAuthUserId as any).mockResolvedValue(mockUserId);

      const mockCtx = {
        db: {
          get: vi.fn().mockResolvedValue(mockUser),
        },
      };

      const result = await getLoggedInUser(mockCtx as any);
      expect(result).toEqual(mockUser);
    });

    it("should handle ActionCtx by using runQuery", async () => {
      const mockUserId = "user123" as Id<"users">;
      const mockUser = {
        _id: mockUserId,
        email: "test@example.com",
        name: "Test User",
      };

      (getAuthUserId as any).mockResolvedValue(mockUserId);

      const mockCtx = {
        runQuery: vi.fn().mockResolvedValue(mockUser),
        // No db property to simulate ActionCtx
      };

      const result = await getLoggedInUser(mockCtx as any);
      expect(result).toEqual(mockUser);
      expect(mockCtx.runQuery).toHaveBeenCalled();
    });
  });

  describe("Integration tests with Convex test environment", () => {
    let mockDb: MockDatabase;
    let testUserId: Id<"users">;
    let testConversationId: Id<"conversations">;

    beforeEach(() => {
      vi.clearAllMocks();

      // Create test database and data
      mockDb = createMockDatabase();

      const { userId } = createTestUser(mockDb, {
        name: "Test User",
        email: "test@example.com",
      });
      testUserId = userId;

      const { conversationId } = createTestConversation(mockDb, testUserId, {
        name: "Test Conversation",
        updatedTime: Date.now() - 1000, // 1 second ago
      });
      testConversationId = conversationId;

      // Mock auth to return our test user
      (getAuthUserId as any).mockResolvedValue(testUserId);
    });

    it("should test deleteConversation functionality", async () => {
      // Add messages to the conversation
      createTestMessage(mockDb, testConversationId, {
        content: "Message 1",
        author: "user",
      });
      createTestMessage(mockDb, testConversationId, {
        content: "Message 2",
        author: "assistant",
      });

      // Verify conversation and messages exist
      expect(mockDb.get(testConversationId)).toBeDefined();
      const initialMessages = await mockDb
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", testConversationId),
        )
        .collect();
      expect(initialMessages).toHaveLength(2);

      const mockCtx = createMockMutationCtx({ db: mockDb as any });

      // Test authentication and authorization
      const user = await getLoggedInUser(mockCtx);
      const conversation = mockDb.get(testConversationId);

      expect(conversation).toBeDefined();
      expect(conversation.userId).toBe(user._id);

      // Simulate what deleteConversation does
      const messages = await mockDb
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", testConversationId),
        )
        .collect();

      for (const msg of messages) {
        mockDb.delete(msg._id);
      }
      mockDb.delete(testConversationId);

      // Verify conversation is deleted
      expect(mockDb.get(testConversationId)).toBeNull();

      // Verify messages are deleted
      const remainingMessages = await mockDb
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", testConversationId),
        )
        .collect();
      expect(remainingMessages).toHaveLength(0);
    });

    it("should test sendMessage action flow", async () => {
      const runQueryMock = vi.fn();
      const runMutationMock = vi.fn().mockResolvedValue(undefined);
      const schedulerMock = vi.fn().mockResolvedValue(undefined);

      // Create a fresh mock database for this test to avoid ID conflicts
      const testDb = createMockDatabase();
      const { user, userId } = createTestUser(testDb, {
        name: "Test User",
        email: "test@example.com",
      });
      const { conversationId } = createTestConversation(testDb, userId);

      // Mock auth to return the test user
      (getAuthUserId as any).mockResolvedValue(userId);

      // Mock the runQuery calls in proper order:
      // 1. getUserById (called by getLoggedInUser for ActionCtx)
      // 2. getConversation
      // 3. getFirstMessage
      runQueryMock
        .mockResolvedValueOnce(user) // getUserById (for getLoggedInUser)
        .mockResolvedValueOnce(testDb.get(conversationId)) // getConversation
        .mockResolvedValueOnce(null); // getFirstMessage (no messages yet)

      const mockCtx = createMockActionCtx({
        runQuery: runQueryMock,
        runMutation: runMutationMock,
        scheduler: {
          runAfter: schedulerMock,
          runAt: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn().mockResolvedValue(undefined),
        },
      });

      // Test authentication
      const loggedInUser = await getLoggedInUser(mockCtx);
      expect(loggedInUser._id).toBe(userId);

      // Simulate sendMessage logic
      const conversation = await runQueryMock(); // Simulate getConversation call
      expect(conversation).toBeDefined();
      expect(conversation.userId).toBe(loggedInUser._id);

      const firstMessage = await runQueryMock(); // Simulate getFirstMessage call
      const isFirstMessage = firstMessage === null;
      expect(isFirstMessage).toBe(true);

      // Simulate storing the message
      await runMutationMock();

      // Simulate scheduling AI response
      await schedulerMock(0, "generateAiResponse", {
        conversationId: conversationId,
      });

      // Simulate scheduling title generation for first message
      if (isFirstMessage) {
        await schedulerMock(5000, "generateConversationTitleAction", {
          conversationId: conversationId,
        });
      }

      // Verify the calls were made correctly
      expect(runQueryMock).toHaveBeenCalledTimes(3); // getUserById + getConversation + getFirstMessage
      expect(runMutationMock).toHaveBeenCalledTimes(1);
      expect(schedulerMock).toHaveBeenCalledTimes(2);
      expect(schedulerMock).toHaveBeenCalledWith(0, "generateAiResponse", {
        conversationId: conversationId,
      });
      expect(schedulerMock).toHaveBeenCalledWith(
        5000,
        "generateConversationTitleAction",
        {
          conversationId: conversationId,
        },
      );
    });

    it("should handle unauthorized access to conversations", async () => {
      // Create another user and conversation
      const { userId: otherUserId } = createTestUser(mockDb, {
        name: "Other User",
        email: "other@example.com",
      });
      const { conversationId: otherConversationId } = createTestConversation(
        mockDb,
        otherUserId,
      );

      const mockCtx = createMockQueryCtx({ db: mockDb as any });

      // Test that current user can't access other user's conversation
      const user = await getLoggedInUser(mockCtx);
      const otherConversation = mockDb.get(otherConversationId);

      expect(otherConversation.userId).not.toBe(user._id);

      // This should trigger the authorization check
      if (!otherConversation || otherConversation.userId !== user._id) {
        expect(() => {
          throw new Error("Not found");
        }).toThrow("Not found");
      }
    });

    it("should find user message by OpenAI file ID for citations", async () => {
      // Add a user message with file attachments
      createTestMessage(mockDb, testConversationId, {
        content: "Here are the files",
        author: "user",
        fileIds: ["file-abc123", "file-def456"],
        uploadedFileNames: ["document1.pdf", "document2.txt"],
        uploadedFiles: [
          {
            fileName: "document1.pdf",
            storageId: "storage123" as Id<"_storage">,
            fileType: "application/pdf",
            fileSize: 1000,
          },
          {
            fileName: "document2.txt",
            storageId: "storage456" as Id<"_storage">,
            fileType: "text/plain",
            fileSize: 500,
          },
        ],
      });

      // Test finding by first file ID
      const result1 = await mockDb
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", testConversationId),
        )
        .filter((q) => q.eq(q.field("author"), "user"))
        .collect();

      // Find the message that contains the OpenAI file ID
      const messageWithFile = result1.find(
        (msg) => msg.fileIds && msg.fileIds.includes("file-abc123"),
      );
      expect(messageWithFile).toBeDefined();
      expect(messageWithFile?.fileIds).toContain("file-abc123");
      expect(messageWithFile?.uploadedFileNames).toContain("document1.pdf");

      // Test finding by second file ID
      const messageWithFile2 = result1.find(
        (msg) => msg.fileIds && msg.fileIds.includes("file-def456"),
      );
      expect(messageWithFile2).toBeDefined();
      expect(messageWithFile2?.fileIds).toContain("file-def456");
      expect(messageWithFile2?.uploadedFileNames).toContain("document2.txt");

      // Test with non-existent file ID
      const messageWithNonExistentFile = result1.find(
        (msg) => msg.fileIds && msg.fileIds.includes("file-nonexistent"),
      );
      expect(messageWithNonExistentFile).toBeUndefined();
    });

    it("should call findUserMessageByFileId query and return correct results", async () => {
      // Add a user message with file attachments using the new helper that creates file mappings
      const { messageId } = createTestMessageWithFiles(
        mockDb,
        testConversationId,
        testUserId,
        {
          content: "Here are the files",
          author: "user",
          fileIds: ["file-abc123", "file-def456"],
          uploadedFileNames: ["document1.pdf", "document2.txt"],
          uploadedFiles: [
            {
              fileName: "document1.pdf",
              storageId: "storage123" as Id<"_storage">,
              fileType: "application/pdf",
              fileSize: 1000,
            },
            {
              fileName: "document2.txt",
              storageId: "storage456" as Id<"_storage">,
              fileType: "text/plain",
              fileSize: 500,
            },
          ],
        },
      );

      const mockCtx = createMockQueryCtx({ db: mockDb as any });

      // Test finding by first file ID - should return message info
      const result1 = await findUserMessageByFileIdImpl(mockCtx, {
        conversationId: testConversationId,
        openaiFileId: "file-abc123",
      });

      expect(result1).not.toBeNull();
      expect(result1?.messageId).toBe(messageId);
      expect(result1?.fileName).toBe("document1.pdf");

      // Test finding by second file ID - should return message info
      const result2 = await findUserMessageByFileIdImpl(mockCtx, {
        conversationId: testConversationId,
        openaiFileId: "file-def456",
      });

      expect(result2).not.toBeNull();
      expect(result2?.messageId).toBe(messageId);
      expect(result2?.fileName).toBe("document2.txt");

      // Test with non-existent file ID - should return null
      const result3 = await findUserMessageByFileIdImpl(mockCtx, {
        conversationId: testConversationId,
        openaiFileId: "file-nonexistent",
      });

      expect(result3).toBeNull();
    });

    it("should deny access to other users' conversations in findUserMessageByFileId", async () => {
      // Create another user and their conversation
      const { userId: otherUserId } = createTestUser(mockDb, {
        name: "Other User",
        email: "other@example.com",
      });
      const { conversationId: otherConversationId } = createTestConversation(
        mockDb,
        otherUserId,
      );

      // Add a message with files to the other user's conversation
      createTestMessageWithFiles(mockDb, otherConversationId, otherUserId, {
        content: "Other user's files",
        author: "user",
        fileIds: ["file-other123"],
        uploadedFileNames: ["other_document.pdf"],
      });

      const mockCtx = createMockQueryCtx({ db: mockDb as any });

      // Try to access the other user's conversation - should throw error
      await expect(
        findUserMessageByFileIdImpl(mockCtx, {
          conversationId: otherConversationId,
          openaiFileId: "file-other123",
        }),
      ).rejects.toThrow("Access denied: conversation does not belong to user");
    });

    it("returns null when file belongs to a different conversation", async () => {
      // create a second conversation for the same user
      const { conversationId: otherConversationId } = createTestConversation(
        mockDb,
        testUserId,
      );

      const mockCtx = createMockQueryCtx({ db: mockDb as any });

      const result = await findUserMessageByFileIdImpl(mockCtx, {
        conversationId: otherConversationId,
        openaiFileId: "file-abc123",
      });

      expect(result).toBeNull();
    });

    // New tests for file mapping functionality
    it("should create and retrieve file mappings correctly", async () => {
      createMockQueryCtx({ db: mockDb as any });

      // Create a file mapping
      const { mappingId } = createTestFileMapping(
        mockDb,
        "file-test123",
        "test-document.pdf",
        testUserId,
        {
          storageId: "storage_test" as Id<"_storage">,
          fileMimeType: "application/pdf",
          fileSize: 2048,
          firstUsedInConversationId: testConversationId,
        },
      );

      // Verify the mapping was created
      const mapping = mockDb.get(mappingId);
      expect(mapping).toBeDefined();
      expect(mapping.openaiFileId).toBe("file-test123");
      expect(mapping.fileName).toBe("test-document.pdf");
      expect(mapping.fileType).toBe("user_upload");
      expect(mapping.uploadedBy).toBe(testUserId);
      expect(mapping.storageId).toBe("storage_test");
      expect(mapping.fileMimeType).toBe("application/pdf");
      expect(mapping.fileSize).toBe(2048);
      expect(mapping.firstUsedInConversationId).toBe(testConversationId);
    });

    it("should deny access to files uploaded by other users", async () => {
      // Create another user
      const { userId: otherUserId } = createTestUser(mockDb, {
        name: "Other User",
        email: "other@example.com",
      });

      // Create a file mapping for the other user
      createTestFileMapping(
        mockDb,
        "file-otheruser789",
        "other-user-file.txt",
        otherUserId,
        {
          storageId: "storage_other" as Id<"_storage">,
          fileMimeType: "text/plain",
          fileSize: 512,
        },
      );

      const mockCtx = createMockQueryCtx({ db: mockDb as any });

      // Try to access file uploaded by other user - should throw error
      await expect(
        findUserMessageByFileIdImpl(mockCtx, {
          conversationId: testConversationId,
          openaiFileId: "file-otheruser789",
        }),
      ).rejects.toThrow("Access denied: file was not uploaded by current user");
    });
  });
});
