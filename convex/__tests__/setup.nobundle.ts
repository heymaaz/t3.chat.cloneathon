import { vi } from "vitest";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Doc, Id, TableNames } from "../_generated/dataModel";

// Mock environment variables for testing
process.env.OPENAI_API_KEY = "test-key";

// Test utilities for creating mock Convex contexts
export interface MockDatabase {
  data: Map<string, Map<string, any>>;
  get: <T extends TableNames>(id: Id<T>) => any;
  insert: <T extends TableNames>(table: T, document: any) => Id<T>;
  query: (table: string) => MockQuery;
  delete: <T extends TableNames>(id: Id<T>) => void;
  patch: <T extends TableNames>(id: Id<T>, patches: any) => void;
  replace: <T extends TableNames>(id: Id<T>, document: any) => void;
  system: {
    get: (id: Id<"_storage">) => any;
  };
}

export interface MockQuery {
  withIndex: (indexName: string, constraint?: (q: any) => any) => MockQuery;
  filter: (predicate: (q: any) => any) => MockQuery;
  order: (direction: "asc" | "desc") => MockQuery;
  take: (n: number) => Promise<any[]>;
  collect: () => Promise<any[]>;
  unique: () => Promise<any>;
  [Symbol.asyncIterator]: () => AsyncIterator<any>;
}

export interface MockScheduler {
  runAfter: (
    delayMs: number,
    functionReference: any,
    args: any,
  ) => Promise<void>;
  runAt: (
    timestamp: number,
    functionReference: any,
    args: any,
  ) => Promise<void>;
  cancel: (jobId: any) => Promise<void>;
}

export interface MockAuth {
  getUserIdentity: () => Promise<any>;
}

// Create a mock database that simulates Convex database behavior
export function createMockDatabase(): MockDatabase {
  const data = new Map<string, Map<string, any>>();
  let idCounter = 1000;

  const getTableData = (table: string) => {
    if (!data.has(table)) {
      data.set(table, new Map());
    }
    return data.get(table)!;
  };

  const createMockQuery = (table: string): MockQuery => {
    const tableData = getTableData(table);
    const filteredData = Array.from(tableData.values());
    let indexFilter: ((item: any) => boolean) | null = null;
    let orderDirection: "asc" | "desc" = "asc";

    const query: MockQuery = {
      withIndex: (indexName: string, constraint?: (q: any) => any) => {
        if (constraint) {
          // Mock index constraint - for simplicity, we'll assume it's an equality check
          const mockQ = {
            eq: (field: string, value: any) => {
              indexFilter = (item: any) => item[field] === value;
            },
          };
          constraint(mockQ);
        }
        return query;
      },

      filter: () => {
        return query;
      },

      order: (direction: "asc" | "desc") => {
        orderDirection = direction;
        return query;
      },

      take: async (n: number) => {
        let results = filteredData;
        if (indexFilter) {
          results = results.filter(indexFilter);
        }

        // Sort by _creationTime if no specific ordering
        results.sort((a, b) => {
          const timeA = a._creationTime || 0;
          const timeB = b._creationTime || 0;
          return orderDirection === "desc" ? timeB - timeA : timeA - timeB;
        });

        return results.slice(0, n);
      },

      collect: async () => {
        let results = filteredData;
        if (indexFilter) {
          results = results.filter(indexFilter);
        }

        // Sort by _creationTime if no specific ordering
        results.sort((a, b) => {
          const timeA = a._creationTime || 0;
          const timeB = b._creationTime || 0;
          return orderDirection === "desc" ? timeB - timeA : timeA - timeB;
        });

        return results;
      },

      unique: async () => {
        const results = await query.collect();
        if (results.length === 0) return null;
        if (results.length > 1)
          throw new Error("unique() returned multiple results");
        return results[0];
      },

      [Symbol.asyncIterator]: async function* () {
        const results = await query.collect();
        for (const item of results) {
          yield item;
        }
      },
    };

    return query;
  };

  return {
    data,
    get: (id: Id<any>) => {
      const [table] = String(id).split("_");
      const tableData = getTableData(table);
      return tableData.get(String(id)) || null;
    },

    insert: (table: string, document: any) => {
      const id = `${table}_${idCounter++}` as Id<any>;
      const tableData = getTableData(table);
      const docWithSystemFields = {
        ...document,
        _id: id,
        _creationTime: Date.now(),
      };
      tableData.set(String(id), docWithSystemFields);
      return id;
    },

    query: (table: string) => createMockQuery(table),

    delete: (id: Id<any>) => {
      const [table] = String(id).split("_");
      const tableData = getTableData(table);
      tableData.delete(String(id));
    },

    patch: (id: Id<any>, patches: any) => {
      const [table] = String(id).split("_");
      const tableData = getTableData(table);
      const existing = tableData.get(String(id));
      if (existing) {
        tableData.set(String(id), { ...existing, ...patches });
      }
    },

    replace: (id: Id<any>, document: any) => {
      const [table] = String(id).split("_");
      const tableData = getTableData(table);
      const existing = tableData.get(String(id));
      if (existing) {
        tableData.set(String(id), {
          ...document,
          _id: existing._id,
          _creationTime: existing._creationTime,
        });
      }
    },

    system: {
      get: (id: Id<"_storage">) => {
        // Mock storage system table
        return {
          _id: id,
          _creationTime: Date.now(),
          contentType: "application/octet-stream",
          sha256: "mock-hash",
          size: 1024,
        };
      },
    },
  };
}

// Create mock contexts for testing
export function createMockQueryCtx(
  overrides: Partial<QueryCtx> = {},
): QueryCtx {
  const mockDb = createMockDatabase();

  return {
    db: mockDb,
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as QueryCtx;
}

export function createMockMutationCtx(
  overrides: Partial<MutationCtx> = {},
): MutationCtx {
  const mockDb = createMockDatabase();
  const mockScheduler: MockScheduler = {
    runAfter: vi.fn().mockResolvedValue(undefined),
    runAt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  };

  return {
    db: mockDb,
    scheduler: mockScheduler,
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as MutationCtx;
}

export function createMockActionCtx(
  overrides: Partial<ActionCtx> = {},
): ActionCtx {
  return {
    runQuery: vi.fn(),
    runMutation: vi.fn(),
    runAction: vi.fn(),
    scheduler: {
      runAfter: vi.fn().mockResolvedValue(undefined),
      runAt: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
    },
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as ActionCtx;
}

// Helper function to create test users
export function createTestUser(
  mockDb: MockDatabase,
  userData: { name: string; email: string } = {
    name: "Test User",
    email: "test@example.com",
  },
): { user: Doc<"users">; userId: Id<"users"> } {
  const userId = mockDb.insert("users", userData);
  const user = mockDb.get(userId);
  return { user, userId };
}

// Helper function to create test conversations
export function createTestConversation(
  mockDb: MockDatabase,
  userId: Id<"users">,
  conversationData: Partial<Doc<"conversations">> = {},
): { conversation: Doc<"conversations">; conversationId: Id<"conversations"> } {
  const conversationId = mockDb.insert("conversations", {
    userId,
    name: "Test Conversation",
    ...conversationData,
  });
  const conversation = mockDb.get(conversationId);
  return { conversation, conversationId };
}

// Helper function to create test messages
export function createTestMessage(
  mockDb: MockDatabase,
  conversationId: Id<"conversations">,
  messageData: Partial<Doc<"messages">> = {},
): { message: Doc<"messages">; messageId: Id<"messages"> } {
  const messageId = mockDb.insert("messages", {
    conversationId,
    author: "user",
    content: "Test message",
    ...messageData,
  });
  const message = mockDb.get(messageId);
  return { message, messageId };
}

// Helper function to create test file mappings
export function createTestFileMapping(
  mockDb: MockDatabase,
  openaiFileId: string,
  fileName: string,
  uploadedBy: Id<"users">,
  options: {
    storageId?: Id<"_storage">;
    fileType?: "user_upload";
    fileMimeType?: string;
    fileSize?: number;
    firstUsedInConversationId?: Id<"conversations">;
    firstUsedInMessageId?: Id<"messages">;
  } = {},
): {
  mapping: Doc<"fileMessageMappings">;
  mappingId: Id<"fileMessageMappings">;
} {
  const mappingId = mockDb.insert("fileMessageMappings", {
    openaiFileId,
    fileName,
    fileType: options.fileType || "user_upload",
    uploadedBy: uploadedBy,
    storageId: options.storageId,
    firstUsedInConversationId: options.firstUsedInConversationId,
    firstUsedInMessageId: options.firstUsedInMessageId,
    fileMimeType: options.fileMimeType,
    fileSize: options.fileSize,
    uploadedAt: Date.now(),
  });
  const mapping = mockDb.get(mappingId);
  return { mapping, mappingId };
}

// Helper function to create test message with files and file mappings
export function createTestMessageWithFiles(
  mockDb: MockDatabase,
  conversationId: Id<"conversations">,
  uploadedBy: Id<"users">,
  messageData: Partial<Doc<"messages">> & {
    fileIds?: string[];
    uploadedFileNames?: string[];
    uploadedFiles?: Array<{
      fileName: string;
      storageId: Id<"_storage">;
      fileType: string;
      fileSize: number;
    }>;
  },
): {
  message: Doc<"messages">;
  messageId: Id<"messages">;
  mappingIds: Id<"fileMessageMappings">[];
} {
  // Create the message first
  const { message, messageId } = createTestMessage(
    mockDb,
    conversationId,
    messageData,
  );

  const mappingIds: Id<"fileMessageMappings">[] = [];

  // Create file mappings if files are provided
  if (messageData.fileIds && messageData.uploadedFileNames) {
    for (let i = 0; i < messageData.fileIds.length; i++) {
      const fileId = messageData.fileIds[i];
      const fileName = messageData.uploadedFileNames[i];
      const uploadedFile = messageData.uploadedFiles?.[i];

      const { mappingId } = createTestFileMapping(
        mockDb,
        fileId,
        fileName,
        uploadedBy,
        {
          storageId: uploadedFile?.storageId,
          fileMimeType: uploadedFile?.fileType,
          fileSize: uploadedFile?.fileSize,
          firstUsedInConversationId: conversationId,
          firstUsedInMessageId: messageId,
        },
      );

      mappingIds.push(mappingId);
    }
  }

  return { message, messageId, mappingIds };
}

// Global test setup
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

// Mock OpenAI with basic helpers used in tests
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Mocked AI response" } }],
          }),
        },
      };
      files = {
        create: vi.fn().mockResolvedValue({ id: "file_mock" }),
      };
      vectorStores = {
        create: vi.fn().mockResolvedValue({ id: "vs_mock" }),
        files: { create: vi.fn().mockResolvedValue({}) },
      };
      responses = {
        create: vi.fn().mockResolvedValue([]),
      };
      static toFile(blob: Blob, fileName: string) {
        return Promise.resolve({
          name: fileName,
          text: () => blob.text(),
          type: blob.type,
          constructor: { name: "File" },
        });
      }
    },
  };
});
