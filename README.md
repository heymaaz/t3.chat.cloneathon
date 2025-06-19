# T3 Chat Clone

<div align="center">

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/heymaaz/t3.chat.cloneathon)

_A modern AI-powered chatbot with intelligent file search and real-time web search capabilities. Try it out at https://t3chatcloneathon.netlify.app_

[Features](#-features) • [Quick Start](#-quick-start) • [Self Hosting](#️-self-hosting) • [Usage](#-usage) • [Tech Stack](#️-tech-stack)

</div>

---

## ✨ Features

### 🔍 **Intelligent File Search**

- **Multi-format support**: PDF, TXT, DOCX
- **AI-powered citations**: Click on file references to preview documents
- **Contextual understanding**: Conversation-specific vector stores
- **Smart indexing**: Automatic document processing and search optimization

### 🌐 **Real-time Web Search**

- **Toggle control**: Enable/disable web search per message
- **Live information**: Access current data and recent events
- **Source citations**: Clickable links to original sources
- **Combined search**: Seamlessly merge file and web results

### 💬 **Advanced Chat Experience**

- **Streaming responses**: Real-time AI interaction
- **Conversation memory**: Persistent chat history
- **Auto-generated titles**: Smart conversation naming
- **Modern UI**: Clean, responsive design with dark/light themes

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org/) (`nvm install 18 && nvm use 18`)
- [pnpm](https://pnpm.io/) (install globally: `npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd <repo-directory>

# Install dependencies
pnpm install

# Set up environment variables
npx convex dev
```

### Development

```bash
# Option 1: Cloud Convex (recommended for production)
pnpm dev

# Option 2: Local Convex (for development)
# Terminal 1:
npx convex dev
# Terminal 2:
pnpm dev:noconvex
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏗️ Self Hosting

### Using Local Convex

Perfect for development and testing:

```bash
# Ensure Node.js 18
nvm install 18 && nvm use 18

# Install dependencies
pnpm install

# Start local Convex backend
npx convex dev
# Follow the prompts:
# ✓ Start without an account (run Convex locally)
# ✓ Choose "new" project
# ✓ Name your project (e.g., "cloneathalon")

# In a new terminal, start the frontend
nvm use 18
pnpm dev:noconvex
```

### Cloud Deployment

#### Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/heymaaz/t3.chat.cloneathon)

#### Manual Deployment

```bash
# Build for production
pnpm build

# Deploy the dist/ folder to your hosting provider
```

---

## 📖 Usage

### 🔍 Web Search

1. Click the **search icon (🔍)** next to the attachment button
2. When enabled, the button highlights in **blue**
3. Messages show **"Web search enabled"** indicator
4. AI responses include **clickable web citations**

### 📁 File Upload

1. Click the **plus (+) button** to upload files
2. **Drag & drop** or browse for supported formats
3. Files are **automatically indexed** for intelligent search
4. AI provides **clickable citations** with document previews

### 💡 Pro Tips

- **Combine searches**: Use both file and web search for comprehensive answers
- **Citation preview**: Click any file citation to view the referenced content
- **Conversation context**: Files remain available throughout the chat session

---

## 🛠️ Tech Stack

### Frontend

- **React 19** - Modern UI library with latest features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Tanstack Router** - Type-safe routing

### Backend

- **Convex** - Real-time database and backend platform
- **Convex Auth** - Secure authentication system

### AI & Search

- **OpenAI GPT-4.1** - Advanced language model
- **OpenAI Responses API** - Streaming responses, file search and web search
- **Vector Stores** - Intelligent document search
- **Web Search API** - Real-time information retrieval
- **OpenRouter** - API for Anthropic, xAI, Google and more models

### Development Tools

- **ESLint** - Code linting and quality
- **Prettier** - Code formatting
- **Vitest** - Unit testing framework
- **TypeScript** - Static type checking

---

## 📋 Available Scripts

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Start frontend + cloud Convex backend       |
| `pnpm dev:noconvex` | Start frontend only (requires local Convex) |
| `pnpm build`        | Build production bundle                     |
| `pnpm lint`         | Run ESLint checks                           |
| `pnpm typecheck`    | Run TypeScript validation                   |
| `pnpm format`       | Format code with Prettier                   |
| `pnpm format:check` | Check code formatting                       |
| `pnpm test`         | Run test suite                              |

---

### Project Structure

```
<repo-directory>/
├── src/                 # Frontend React application
│   ├── components/     # Reusable UI components
│   ├── pages/         # Application pages
│   └── lib/           # Utilities and helpers
├── convex/             # Backend Convex functions
│   ├── schema.ts      # Database schema
│   └── *.ts          # API functions and mutations
└── public/            # Static assets
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Run `pnpm lint`, `pnpm typecheck`, `pnpm format`, and `pnpm format:check` before committing
- Follow the existing code style and conventions
- Add tests for new features when applicable

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using modern web technologies**

[Report Bug](https://github.com/heymaaz/t3.chat.cloneathon/issues) • [Request Feature](https://github.com/heymaaz/t3.chat.cloneathon/issues)

</div>
