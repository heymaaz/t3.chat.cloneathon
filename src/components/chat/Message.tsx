import { memo, useMemo, useState } from "react";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Id, Doc } from "@backend/_generated/dataModel";
import { Search } from "lucide-react";

type Citation =
  | {
      type: "file";
      fileId: string;
      fileName: string;
    }
  | {
      type: "url";
      url: string;
      title: string;
    };

type Message = Doc<"messages"> & {
  citations?: Citation[];
};

export interface MessageProps {
  message: Message;
  truncateFileName: (fileName: string, isCitation?: boolean) => string;
  handleFilePreview: (messageId: Id<"messages">, fileName: string) => void;
  handleCitationClick?: (
    conversationId: Id<"conversations">,
    openaiFileId: string,
  ) => void;
}

const MessageComponent = memo(
  ({
    message,
    truncateFileName,
    handleFilePreview,
    handleCitationClick,
  }: MessageProps) => {
    const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

    const parsedContent = useMemo(() => {
      if (!message.content || message.content.trim() === "") return "";
      const html = marked.parse(message.content, { async: false });
      return DOMPurify.sanitize(html);
    }, [message.content]);

    const parsedReasoningContent = useMemo(() => {
      if (!message.reasoningSummary || message.reasoningSummary.trim() === "")
        return "";

      // Convert standalone bold text that looks like headers to actual headers
      let processedContent = message.reasoningSummary;

      // Replace bold text that appears to be section headers
      processedContent = processedContent.replace(
        /\*\*([^*]+)\*\*(?=\s*[A-Z])/g,
        "\n\n### $1\n\n",
      );

      const html = marked.parse(processedContent, { async: false });
      return DOMPurify.sanitize(html);
    }, [message.reasoningSummary]);

    return (
      <div
        className={`flex ${message.author === "user" ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`flex items-start gap-2 md:gap-3 ${
            message.author === "user"
              ? message.uploadedFileNames &&
                message.uploadedFileNames.length > 0
                ? "max-w-[95%] sm:max-w-[90%] md:max-w-[80%]"
                : "max-w-[90%] sm:max-w-[85%] md:max-w-[70%]"
              : "max-w-[95%] sm:max-w-[95%] md:max-w-[85%]"
          }`}
        >
          <div
            className={`rounded-lg px-3 py-2 md:px-4 md:py-2 min-w-0 flex-1 ${
              message.author === "user"
                ? "bg-primary text-primary-foreground"
                : ""
            }`}
          >
            {message.author === "user" &&
              message.uploadedFileNames &&
              message.uploadedFileNames.length > 0 && (
                <div className="mb-2 space-y-1 w-full">
                  {message.uploadedFileNames.map(
                    (fileName: string, fileIdx: number) => (
                      <button
                        key={fileIdx}
                        onClick={() => handleFilePreview(message._id, fileName)}
                        className="p-2 border border-border rounded-md bg-background/50 flex items-center gap-2 min-w-0 w-full hover:bg-background/70 transition-colors cursor-pointer"
                      >
                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground dark:text-gray-300 shrink-0" />
                        <span className="text-xs md:text-sm text-foreground dark:text-white truncate min-w-0 flex-1">
                          {truncateFileName(fileName)}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            {/* Reasoning Section - Display first if available */}
            {message.author === "assistant" && message.reasoningSummary && (
              <div className="mb-3">
                <button
                  onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                  className="flex items-center gap-2 w-full text-left p-3 rounded-t-md hover:bg-muted/10 transition-colors"
                >
                  {isReasoningExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    Reasoning
                  </span>
                </button>
                {isReasoningExpanded && (
                  <div className="p-4 border-l border-l-accent-foreground">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: parsedReasoningContent,
                      }}
                      className="text-lg text-muted-foreground prose prose-sm max-w-none dark:prose-invert break-words overflow-wrap-anywhere [&>p]:mb-2 [&>p]:leading-relaxed [&>h3]:mt-4 [&>h3]:mb-2 [&>h3]:font-semibold"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Main Message Content */}
            {parsedContent && (
              <div
                dangerouslySetInnerHTML={{ __html: parsedContent }}
                className={`prose prose-sm max-w-none dark:prose-invert break-words overflow-wrap-anywhere [&>p]:my-0 ${message.author === "assistant" ? "text-lg" : ""}`}
              />
            )}
            {message.author === "assistant" &&
              message.citations &&
              message.citations.length > 0 && (
                <div className="mt-2 space-y-1 w-full">
                  <div className="text-xs text-muted-foreground dark:text-gray-300 mb-1">
                    Sources:
                  </div>
                  {message.citations.map(
                    (citation: Citation, citationIdx: number) => {
                      const isClickable =
                        citation.type === "file" && handleCitationClick;

                      return isClickable ? (
                        <button
                          key={citationIdx}
                          className="p-2 border border-border rounded-md bg-background/50 flex items-center gap-2 min-w-0 w-full hover:bg-background/70 transition-colors cursor-pointer"
                          onClick={() =>
                            handleCitationClick(
                              message.conversationId,
                              citation.fileId,
                            )
                          }
                        >
                          <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground dark:text-gray-300 shrink-0" />
                          <span className="text-xs md:text-sm text-foreground dark:text-white truncate min-w-0 flex-1">
                            {truncateFileName(citation.fileName, true)}
                          </span>
                        </button>
                      ) : (
                        <div
                          key={citationIdx}
                          className="p-2 border border-border rounded-md bg-background/50 flex items-center gap-2 min-w-0 w-full"
                        >
                          {citation.type === "file" ? (
                            <>
                              <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground dark:text-gray-300 shrink-0" />
                              <span className="text-xs md:text-sm text-foreground dark:text-white truncate min-w-0 flex-1">
                                {truncateFileName(citation.fileName, true)}
                              </span>
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground dark:text-gray-300 shrink-0" />
                              <a
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs md:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate min-w-0 flex-1"
                              >
                                {truncateFileName(citation.title, true)}
                              </a>
                            </>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    );
  },
);

MessageComponent.displayName = "MessageComponent";
export default MessageComponent;
