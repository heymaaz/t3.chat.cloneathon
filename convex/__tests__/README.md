# Convex Testing Environment

This directory contains a comprehensive testing environment for Convex functions, providing utilities for unit testing and integration testing of queries, mutations, and actions.

## Overview

The testing environment includes:

- **Mock Database**: A complete in-memory database simulation that mimics Convex's database API
- **Mock Contexts**: Factory functions for creating test contexts (QueryCtx, MutationCtx, ActionCtx)
- **Test Helpers**: Utilities for creating test data and managing test state
- **Authentication Mocking**: Mock authentication system for testing user-specific functionality

## Files

- `setup.nobundle.ts` - Core testing utilities and mock implementations
- `chatQueriesAndMutations.test.ts` - Example tests demonstrating the testing environment
- `README.md` - This documentation file

## Core Features

### Mock Database

The mock database (`MockDatabase`) provides a complete simulation of Convex's database operations:

```typescript
interface MockDatabase {
  data: Map<string, Map<string, any>>;
  get: (id: Id<any>) => any | null;
  insert: (table: string, document: any) => Id<any>;
  query: (table: string) => MockQuery;
  delete: (id: Id<any>) => void;
  patch: (id: Id<any>, patches: any) => void;
  replace: (id: Id<any>, document: any) => void;
  system: {
    get: (id: Id<"_storage">) => any | null;
  };
}
```

#### Query Operations

- **Indexing**: Supports `withIndex()` with constraint functions
- **Filtering**: Basic filtering with `filter()`
- **Ordering**: Ascending and descending order with `order()`
- **Collection**: `collect()`, `take(n)`, `unique()`
- **Async Iteration**: Full support for `for await` loops

### Mock Contexts

#### QueryCtx

```typescript
const mockQueryCtx = createMockQueryCtx({
  db: customMockDb, // Optional: provide your own mock database
});
```

#### MutationCtx

```typescript
const mockMutationCtx = createMockMutationCtx({
  db: customMockDb, // Optional: provide your own mock database
  scheduler: customScheduler, // Optional: provide custom scheduler mock
});
```

#### ActionCtx

```typescript
const mockActionCtx = createMockActionCtx({
  runQuery: vi.fn(),
  runMutation: vi.fn(),
  runAction: vi.fn(),
  scheduler: customScheduler,
});
```

### Test Data Helpers

#### Creating Test Users

```typescript
const { user, userId } = createTestUser(mockDb, {
  name: "Test User",
  email: "test@example.com",
});
```

#### Creating Test Conversations

```typescript
const { conversation, conversationId } = createTestConversation(
  mockDb,
  userId,
  {
    name: "Test Conversation",
    updatedTime: Date.now(),
  },
);
```

#### Creating Test Messages

```typescript
const { message, messageId } = createTestMessage(mockDb, conversationId, {
  content: "Test message",
  author: "user",
});
```

## Usage Examples

### Testing Queries

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockQueryCtx,
  createMockDatabase,
  createTestUser,
} from "./setup";
import { listConversations } from "../chatQueriesAndMutations";

describe("listConversations", () => {
  let mockDb: MockDatabase;
  let testUserId: Id<"users">;

  beforeEach(() => {
    mockDb = createMockDatabase();
    const { userId } = createTestUser(mockDb);
    testUserId = userId;
  });

  it("should return user conversations", async () => {
    const mockCtx = createMockQueryCtx({ db: mockDb });

    // Test the query logic directly
    const conversations = await mockDb
      .query("conversations")
      .withIndex("by_userId", (q) => q.eq("userId", testUserId))
      .collect();

    expect(conversations).toHaveLength(0);
  });
});
```

### Testing Mutations

```typescript
import { createMockMutationCtx, createMockDatabase } from "./setup";
import { createConversation } from "../chatQueriesAndMutations";

describe("createConversation", () => {
  it("should create a new conversation", async () => {
    const mockDb = createMockDatabase();
    const { userId } = createTestUser(mockDb);

    const mockCtx = createMockMutationCtx({ db: mockDb });

    // Mock authentication
    (getAuthUserId as any).mockResolvedValue(userId);

    // Test creation logic
    const conversationId = mockDb.insert("conversations", {
      userId,
      name: "New Chat",
    });

    expect(conversationId).toBeDefined();
    const conversation = mockDb.get(conversationId);
    expect(conversation.name).toBe("New Chat");
  });
});
```

### Testing Actions

```typescript
import { createMockActionCtx, createMockDatabase } from "./setup";
import { sendMessage } from "../chatQueriesAndMutations";

describe("sendMessage", () => {
  it("should store message and schedule AI response", async () => {
    const runQueryMock = vi.fn();
    const runMutationMock = vi.fn();
    const schedulerMock = vi.fn();

    const mockCtx = createMockActionCtx({
      runQuery: runQueryMock,
      runMutation: runMutationMock,
      scheduler: { runAfter: schedulerMock },
    });

    // Set up mocks and test action flow
    runQueryMock.mockResolvedValueOnce(testUser); // getUserById
    runQueryMock.mockResolvedValueOnce(testConversation); // getConversation

    await sendMessage.handler(mockCtx, {
      conversationId: "test_conversation_id",
      content: "Hello!",
    });

    expect(runMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: "Hello!",
      }),
    );
    expect(schedulerMock).toHaveBeenCalledWith(
      0,
      expect.anything(),
      expect.objectContaining({
        conversationId: "test_conversation_id",
      }),
    );
  });
});
```

### Authentication Testing

The testing environment automatically mocks the `@convex-dev/auth/server` module:

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";

// In your test
(getAuthUserId as any).mockResolvedValue("test_user_id");

// Test functions that require authentication
const user = await getLoggedInUser(mockCtx);
expect(user._id).toBe("test_user_id");
```

## Configuration

### Vitest Configuration

The testing environment is configured in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./convex/__tests__/setup.nobundle.ts"],
    testTimeout: 30000,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
  // ... other config
});
```

### Global Setup

The `setup.nobundle.ts` file automatically:

- Mocks `@convex-dev/auth/server`
- Mocks `openai` module
- Sets up test environment variables

## Best Practices

1. **Use `beforeEach` for Fresh State**: Create a new mock database for each test to avoid state pollution
2. **Mock Authentication**: Always mock `getAuthUserId` to return appropriate user IDs
3. **Test Business Logic**: Focus on testing the business logic rather than Convex framework details
4. **Use Type Assertions**: Use `as any` sparingly for bypassing strict typing when necessary
5. **Test Error Cases**: Test unauthorized access, missing data, and validation errors

## Limitations

- **Schema Validation**: The mock database doesn't enforce schema validation
- **System Tables**: Limited support for system tables (only basic `_storage` mocking)
- **Real-time Features**: No support for testing real-time subscriptions
- **File Storage**: Basic mocking of file storage operations
- **Advanced Queries**: Complex query operations may need manual implementation

## Integration with Convex

This testing environment is designed to work alongside Convex's built-in testing tools. For more comprehensive testing, consider using:

- **Convex Test Environment**: For testing against a real local Convex backend
- **End-to-End Tests**: For testing the complete application flow
- **Manual Testing**: Using the Convex dashboard for interactive testing

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- convex/__tests__/chatQueriesAndMutations.test.ts

# Run tests with coverage
npm test -- --coverage
```
