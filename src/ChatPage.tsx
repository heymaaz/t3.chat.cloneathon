import MessageComponent from "@/components/chat/Message";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { useChat } from "@/components/chat/useChat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { ModelPicker } from "@/components/ui/ModelPicker";
import { ThinkingIntensityPicker } from "@/components/ui/ThinkingIntensityPicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Paperclip,
  AlertCircle,
  X,
  Globe,
  ArrowUp,
} from "lucide-react";
import {
  SUPPORTED_FILE_TYPES,
  MAX_FILES,
  isThinkingModel,
  isWebSearchModel,
  SUPPORTED_MODELS,
} from "@backend/constants";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useMemo, useCallback } from "react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

export default function ChatPage() {
  const [messageValue, setMessageValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const {
    conversations,
    selectedConversationId,
    isLoadingConversation,
    messagesForSelectedConversation,
    truncateFileName,
    handleFilePreview,
    messagesEndRef,
    selectedFiles,
    removeSelectedFile,
    handleSubmit,
    handleAttachmentClick,
    handleFileChange,
    isAITyping,
    isUploadingFiles,
    fileInputRef,
    handleConversationSelect,
    handleCreateConversation,
    handleDeleteConversation,
    filePreviewModal,
    closeFilePreview,
    webSearchEnabled,
    setWebSearchEnabled,
    selectedModel,
    setSelectedModel,
    thinkingIntensity,
    setThinkingIntensity,
    isOpen,
    setIsOpen,
    handleCitationClick,
  } = useChat();

  // Local submit handler to clear textarea after send
  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageValue.trim()) {
      void handleSubmit(messageValue);
      setMessageValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const isThinking = isThinkingModel(selectedModel);
  const isWebSearch = isWebSearchModel(selectedModel);

  const tooltipText = useMemo(() => {
    return !messageValue.trim() ? "Message requires text" : "Send message";
  }, [messageValue]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounterRef.current = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // Create a synthetic event to pass to handleFileChange
        const syntheticEvent = {
          target: {
            files: e.dataTransfer.files,
          },
        } as React.ChangeEvent<HTMLInputElement>;

        void handleFileChange(syntheticEvent);
        e.dataTransfer.clearData();
      }
    },
    [handleFileChange],
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="flex h-[calc(100vh-4rem)] bg-background relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <ChatSidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onConversationSelect={handleConversationSelect}
          onCreateConversation={() => void handleCreateConversation()}
          onDeleteConversation={(id) => void handleDeleteConversation(id)}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />

        <div
          className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${
            isOpen ? "md:ml-64" : "md:ml-0"
          }`}
        >
          <ScrollArea className="flex-1 p-2 md:p-4">
            {!selectedConversationId ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4">
                <h2 className="text-xl md:text-2xl font-semibold text-foreground">
                  Welcome to t3 chat clone
                </h2>
                <p className="text-sm text-muted-foreground">
                  Start typing to begin the conversation
                </p>
              </div>
            ) : isLoadingConversation ? (
              <div className="h-full" />
            ) : !messagesForSelectedConversation ||
              messagesForSelectedConversation.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4">
                <h2 className="text-xl md:text-2xl font-semibold text-foreground">
                  Welcome to t3 chat clone
                </h2>
                <p className="text-sm text-muted-foreground">
                  Start typing to begin the conversation
                </p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                {messagesForSelectedConversation.map((message, idx) => (
                  <MessageComponent
                    key={message._id ?? idx}
                    message={message}
                    truncateFileName={truncateFileName}
                    handleFilePreview={handleFilePreview}
                    handleCitationClick={handleCitationClick}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="bg-gradient-to-t from-background to-background/80 px-2 pt-4 md:px-4 md:pt-6">
            <div className="mx-auto flex max-w-3xl flex-col">
              {selectedFiles.length > 0 && (
                <ScrollArea className="max-h-32 mb-2 md:max-h-48">
                  <div className="space-y-1 pr-2">
                    {selectedFiles.map((sfState) => (
                      <div
                        key={sfState.uuid}
                        className="flex items-center justify-between p-2 border border-border rounded-lg bg-muted/50 text-xs md:text-sm"
                      >
                        <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                          {sfState.status === "uploading" && (
                            <Loader2 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground dark:text-gray-300 animate-spin shrink-0" />
                          )}
                          {sfState.status === "uploaded" && (
                            <Paperclip className="h-3 w-3 md:h-4 md:w-4 text-green-500 shrink-0" />
                          )}
                          {sfState.status === "error" && (
                            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-red-500 shrink-0" />
                          )}
                          <span
                            className={`truncate min-w-0 ${
                              sfState.status === "error"
                                ? "text-red-500"
                                : "text-foreground dark:text-white"
                            }`}
                          >
                            {truncateFileName(sfState.file.name)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 md:h-6 md:w-6 rounded-full shrink-0"
                          onClick={() => removeSelectedFile(sfState)}
                          disabled={sfState.status === "uploading"}
                        >
                          <X className="h-2 w-2 md:h-3 md:w-3" />
                          <span className="sr-only">Remove file</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <form onSubmit={handleLocalSubmit} className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => void handleFileChange(e)}
                  accept={SUPPORTED_FILE_TYPES.map((type) => `.${type}`).join(
                    ",",
                  )}
                  multiple
                  style={{ display: "none" }}
                />
                <div className="flex flex-col rounded-t-2xl border border-border bg-background p-0">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Type your message..."
                    disabled={isAITyping || isUploadingFiles}
                    value={messageValue}
                    onChange={(e) => {
                      setMessageValue(e.target.value);
                      // Auto-resize logic
                      const textarea = e.target;
                      textarea.style.height = "auto";
                      const maxHeight = 10 * 24; // 10 lines * 24px (approx line height)
                      textarea.style.height =
                        Math.min(textarea.scrollHeight, maxHeight) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (messageValue.trim()) {
                          void handleSubmit(messageValue);
                          setMessageValue("");
                          if (textareaRef.current) {
                            textareaRef.current.style.height = "auto";
                          }
                        }
                      }
                    }}
                    className="resize-none overflow-auto border-none bg-transparent dark:bg-transparent text-foreground rounded-t-2xl px-6 py-6 text-base focus:ring-0 focus-visible:ring-0 shadow-none"
                    style={{ maxHeight: "240px" }}
                  />
                  <div className="flex items-center justify-between bg-background px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <ModelPicker
                        selectedModel={
                          SUPPORTED_MODELS.find(
                            (m) => m.name === selectedModel,
                          ) ?? SUPPORTED_MODELS[0]
                        }
                        onModelChange={(model) => setSelectedModel(model.name)}
                        disabled={isAITyping || isUploadingFiles}
                      />

                      {isThinking && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <ThinkingIntensityPicker
                                  selectedIntensity={thinkingIntensity}
                                  onIntensityChange={setThinkingIntensity}
                                  disabled={isAITyping || isUploadingFiles}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs opacity-80">
                                Thinking intensity
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {isWebSearch && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                className={cn(
                                  "flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium text-primary hover:text-primary",
                                  webSearchEnabled && "bg-accent",
                                )}
                                onClick={() =>
                                  setWebSearchEnabled(!webSearchEnabled)
                                }
                                disabled={isAITyping || isUploadingFiles}
                              >
                                <Globe className="h-4 w-4" />
                                <span className="hidden md:block">Search</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs opacity-80">
                                Search the web
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium text-primary hover:text-primary"
                              onClick={handleAttachmentClick}
                              disabled={
                                selectedFiles.length >= MAX_FILES ||
                                isUploadingFiles
                              }
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="hidden md:block">Attach</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              {selectedFiles.length >= MAX_FILES ? (
                                <p>Maximum {MAX_FILES} files allowed</p>
                              ) : (
                                <>
                                  <p className="text-xs opacity-80">
                                    Add an attachment
                                  </p>
                                  <p className="text-xs opacity-80">
                                    Accepts: {SUPPORTED_FILE_TYPES.join(", ")}
                                  </p>
                                </>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block">
                            <Button
                              type="submit"
                              size="icon"
                              disabled={
                                isAITyping ||
                                isUploadingFiles ||
                                !messageValue.trim()
                              }
                              className="rounded-lg h-10 w-10 flex items-center justify-center bg-primary text-white hover:bg-primary/90 shadow-md"
                              aria-label="Send message"
                            >
                              <ArrowUp className="h-5 w-5" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs opacity-80">{tooltipText}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {filePreviewModal.isOpen && filePreviewModal.messageId && (
          <FilePreviewModal
            isOpen={filePreviewModal.isOpen}
            onClose={closeFilePreview}
            messageId={filePreviewModal.messageId}
            fileName={filePreviewModal.fileName}
          />
        )}

        {/* Drag and Drop Overlay */}
        {isDragOver && (
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
            role="region"
            aria-label="Drag and drop overlay. Drop files here to attach them to your message."
          >
            <div className="bg-background border-2 border-dashed border-primary rounded-2xl p-12 text-center max-w-md mx-auto">
              <div className="flex flex-col items-center space-y-4">
                <div className="rounded-full bg-primary/10 p-6">
                  <Upload className="h-12 w-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    Add Attachment
                  </h3>
                  <p className="text-muted-foreground">
                    Drop a file here to attach it to your message
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Accepted file types:{" "}
                    {SUPPORTED_FILE_TYPES.join(", ").toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
