# T3 Chat Clone Setup

A modern AI-powered chatbot with file search and web search.

This project uses [pnpm](https://pnpm.io/) for dependency management. Install it globally if you don't have it.

## Quick Start

```bash
git clone <repository-url>
cd chatbot_using_convex
pnpm install
cp .env.example .env.local
# edit .env.local with your Convex keys
# Add your OpenAI API key to convex dashboard
npx convex env set CONVEX_OPENAI_API_KEY {YOUR_CONVEX_OPENAI_API_KEY}
pnpm dev
```

The `dev` script spins up both the Vite frontend and Convex backend.

### Environment variables

`.env.example` contains the variables required to run the app:

```text
CONVEX_DEPLOYMENT=your-convex-deployment
VITE_CONVEX_URL=your-vite-convex-url
```

Copy this file to `.env.local` and fill in your own values.

### Common scripts

- `pnpm dev` – start the frontend and backend in development mode
- `pnpm build` – build the production bundle
- `pnpm lint` – run ESLint
- `pnpm typecheck` – run TypeScript type checks
- `pnpm format` – run prettier checks and fixes
- `pnpm format:check` – run prettier checks without fixing

## Features

### File Search

- Upload and search through documents (PDF, TXT, DOC, DOCX, MD)
- AI can reference specific files and provide citations
- **Clickable citations** - Click on file citations to preview the referenced document
- Conversation-specific vector stores for context

### Web Search

- Toggle web search on/off for individual messages
- AI can search the web for real-time information
- Web results are cited with clickable links
- Combine with file search for comprehensive answers

### Real-time Chat

- Streaming AI responses
- Message history per conversation
- Automatic conversation title generation

## Usage

### Web Search

1. Click the search icon (🔍) next to the attachment button to enable web search
2. When enabled, the button will be highlighted in blue
3. Your messages will show "Web search enabled" indicator
4. AI responses will include web citations when relevant

### File Upload

1. Click the plus (+) button to upload files
2. Supported formats: PDF, TXT, DOC, DOCX, MD
3. Files are automatically indexed for search
4. AI can reference and cite uploaded documents

## Technical Implementation

- **Frontend**: React with TypeScript, Tailwind CSS
- **Backend**: Convex for database and real-time updates
- **AI**: OpenAI GPT-4.1 with Responses API
- **File Search**: OpenAI Vector Stores
- **Web Search**: OpenAI Web Search Preview tool

## Project structure

The frontend code is in the `src` directory and is built with [Vite](https://vitejs.dev/).

The backend code is in the `convex` directory.

`pnpm dev` will start the frontend and backend servers.

## App authentication

[Convex Auth](https://auth.convex.dev/)
