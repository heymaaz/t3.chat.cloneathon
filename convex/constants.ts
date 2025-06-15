/* eslint-disable no-useless-escape */
export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const SUPPORTED_FILE_TYPES = ["txt", "pdf", "docx"] as const; // Whitelisted file types

export const SUPPORTED_MODELS = [
  {
    name: "OpenAI GPT-4.1",
    id: "gpt-4.1",
    description: "Fast, best for web search",
    thinking: false,
    webSearch: true,
    fileSearch: true,
    openRouter: false,
  },
  {
    name: "OpenAI o4 Mini",
    id: "o4-mini",
    description: "Fast and powerful",
    thinking: true,
    webSearch: false,
    fileSearch: true,
    openRouter: false,
  },
  {
    name: "OpenAI o3",
    id: "o3",
    description: "Slower but more powerful",
    thinking: true,
    webSearch: false,
    fileSearch: true,
    openRouter: false,
  },
  {
    name: "OpenAI o3 Pro",
    id: "o3-pro",
    description:
      "Deep Research, use for background tasks, can take 5-10 minutes",
    thinking: true,
    webSearch: false,
    fileSearch: true,
    openRouter: false,
  },
  {
    name: "Google Gemini 2.0 Flash",
    id: "google/gemini-2.0-flash-001",
    description: "Gemini 2.0 Flash via OpenRouter",
    thinking: false,
    webSearch: true,
    fileSearch: false,
    openRouter: true,
  },
  {
    name: "Grok 3 Mini",
    id: "x-ai/grok-3-mini-beta",
    description: "Grok 3 Mini reasoning model via OpenRouter",
    thinking: true,
    webSearch: false,
    fileSearch: false,
    openRouter: true,
  },
] as const;

export const WEB_SEARCH_MODELS = SUPPORTED_MODELS.filter(
  (model): model is Extract<typeof model, { webSearch: true }> =>
    model.webSearch,
).map((model) => model.id);

export const THINKING_MODELS = SUPPORTED_MODELS.filter(
  (model): model is Extract<typeof model, { thinking: true }> => model.thinking,
).map((model) => model.id);

export const FILE_SEARCH_MODELS = SUPPORTED_MODELS.filter(
  (model): model is Extract<typeof model, { fileSearch: true }> =>
    model.fileSearch,
).map((model) => model.id);

export const OPENROUTER_MODELS = SUPPORTED_MODELS.filter(
  (model): model is Extract<typeof model, { openRouter: true }> =>
    model.openRouter,
).map((model) => model.id);

export const isOpenRouterModel = (
  model: string,
): model is (typeof OPENROUTER_MODELS)[number] => {
  return (OPENROUTER_MODELS as readonly string[]).includes(model);
};

export const SYSTEM_PROMPT = `
You are T3 Chat Clone, an AI assistant powered by the {model-name}. My role is to assist and engage in conversation while being helpful, respectful, and engaging.
- If you are specifically asked about the model you are using, you may mention that you use the {model-name} model. If you are not asked specifically about the model you are using, you do not need to mention it.
- The current date and time including timezone is {user-time-with-timezone}.

# Output Format

- Use bullet points, headings, and proper markdown syntax to organize content.
- Include citations from the uploaded file when relevant.
- Always use LaTeX for mathematical expressions:
    - Inline math must be wrapped in escaped parentheses: \( content \)
    - Do not use single dollar signs for inline math
    - Display math must be wrapped in double dollar signs: $$ content $$
- Do not use the backslash character to escape parenthesis. Use the actual parentheses instead.
- Ensure code is properly formatted using Prettier with a print width of 80 characters
- Present code in Markdown code blocks with the correct language extension indicated.
`.trim();

// Thinking intensity levels for reasoning models
export const THINKING_INTENSITY_LEVELS = ["high", "medium", "low"] as const;
export type ThinkingIntensity = (typeof THINKING_INTENSITY_LEVELS)[number];

// Helper function to check if a model is supported
export const isSupportedModel = (
  model: string,
): model is (typeof SUPPORTED_MODELS)[number]["id"] => {
  return (SUPPORTED_MODELS as readonly (typeof SUPPORTED_MODELS)[number][])
    .map((model) => model.id)
    .includes(model as (typeof SUPPORTED_MODELS)[number]["id"]);
};

// Helper function to check if a model supports thinking intensity
export const isThinkingModel = (
  model: string,
): model is (typeof THINKING_MODELS)[number] => {
  return (THINKING_MODELS as readonly string[]).includes(model);
};

// Helper function to check if a model supports web search
export const isWebSearchModel = (
  model: string,
): model is (typeof WEB_SEARCH_MODELS)[number] => {
  return (WEB_SEARCH_MODELS as readonly string[]).includes(model);
};

// Helper function to check if a model supports file search
export const isFileSearchModel = (
  model: string,
): model is (typeof FILE_SEARCH_MODELS)[number] => {
  return (FILE_SEARCH_MODELS as readonly string[]).includes(model);
};

// MIME type mapping for supported file types
export const SUPPORTED_MIME_TYPES = [
  "text/plain", // .txt files
  "application/pdf", // .pdf files
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx files
] as const;

// Helper function to check if a file type is supported
export const isSupportedFileType = (mimeType: string): boolean => {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
};

// Helper function to check if a file extension is supported
export const isSupportedFileExtension = (
  extension: string | undefined,
): boolean => {
  if (!extension) return false;
  return (SUPPORTED_FILE_TYPES as readonly string[]).includes(
    extension.toLowerCase(),
  );
};

// Helper function to get MIME type from file extension
export function getMimeType(fileName: string, fileExtension?: string): string {
  const extension = fileExtension || fileName.split(".").pop()?.toLowerCase();

  const mimeTypeMap: Record<string, string> = {
    txt: "text/plain",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
    htm: "text/html",
  };

  return mimeTypeMap[extension || ""] || "application/octet-stream";
}
