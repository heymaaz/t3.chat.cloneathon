import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  createMockDatabase,
  createTestUser,
  createTestConversation,
  createMockMutationCtx,
  type MockDatabase,
} from "./setup.nobundle";
import { updateConversationVectorStore } from "../chatQueriesAndMutations";
import type { Id } from "../_generated/dataModel";

let _chatModule: typeof import("../chat");

beforeAll(async () => {
  process.env.CONVEX_OPENAI_API_KEY = "test";
  process.env.CONVEX_OPENAI_BASE_URL = "https://example.com";
  _chatModule = await import("../chat");
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("File polyfill", () => {
  it("exposes File globally and supports OpenAI.toFile", async () => {
    const content = "hello";
    const blob = new Blob([content], { type: "text/plain" });
    const OpenAI = (await import("openai")).default;
    const file = await OpenAI.toFile(blob, "test.txt");
    expect((globalThis as any).File).toBeDefined();
    expect((file as any).name).toBe("test.txt");
    expect(await (file as any).text()).toBe(content);
    expect((file as any).constructor.name).toBe("File");
  });
});

describe("updateConversationVectorStore", () => {
  let mockDb: MockDatabase;
  let conversationId: Id<"conversations">;
  beforeEach(() => {
    mockDb = createMockDatabase();
    const { userId } = createTestUser(mockDb);
    ({ conversationId } = createTestConversation(mockDb, userId));
  });

  it("stores the vector store id", async () => {
    const ctx = createMockMutationCtx({ db: mockDb as any });
    await (updateConversationVectorStore as any)._handler(ctx, {
      conversationId,
      vectorStoreId: "vs_mock",
    });
    const updated = mockDb.get(conversationId);
    expect(updated.vectorStoreId).toBe("vs_mock");
  });
});
