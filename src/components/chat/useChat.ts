import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@backend/_generated/api";
import type { Id } from "@backend/_generated/dataModel";
import { toast } from "sonner";
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  SUPPORTED_FILE_TYPES,
  isSupportedFileType,
  SUPPORTED_MODELS,
  isThinkingModel,
  supportsThinkingAndWebSearch,
  isOpenRouterModel,
  type ThinkingIntensity,
} from "@backend/constants";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { loadApiKeysFromStorage, hasApiKey } from "@/lib/api-keys";

const MOBILE_FILENAME_TRUNCATION_THRESHOLD = 15;
const DESKTOP_FILENAME_TRUNCATION_THRESHOLD = 30;

export interface SelectedFileState {
  uuid: string;
  file: File;
  convexStorageId?: Id<"_storage">;
  status: "pending" | "uploading" | "uploaded" | "error";
  errorMessage?: string;
}

export interface FilePreviewModalState {
  isOpen: boolean;
  messageId: Id<"messages"> | null;
  fileName: string;
}

export function useChat() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const urlConversationId =
    (params?.conversationId as Id<"conversations"> | undefined) ?? null;

  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(urlConversationId);
  useEffect(() => {
    setSelectedConversationId(urlConversationId);
  }, [urlConversationId]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const previousConversationIdRef = useRef<Id<"conversations"> | null>(null);
  const shouldAutoScrollRef = useRef(false);
  const lastModelRestoredConversationRef = useRef<Id<"conversations"> | null>(
    null,
  );
  const lastMessageCountRef = useRef<number>(0);
  const seenErrorMessageIdsRef = useRef<Set<string>>(new Set());

  const createConversation = useMutation(
    api.chatQueriesAndMutations.createConversation,
  );
  const conversations = useQuery(api.chatQueriesAndMutations.listConversations);
  const sendMessageAction = useAction(api.chatQueriesAndMutations.sendMessage);
  const uploadFileAndSendMessageAction = useAction(
    api.chat.uploadFileAndSendMessage,
  );
  const deleteConversation = useMutation(
    api.chatQueriesAndMutations.deleteConversation,
  );

  const generateUploadUrl = useMutation(
    api.chatQueriesAndMutations.generateUploadUrl,
  );

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileState[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useLocalStorageState<
    (typeof SUPPORTED_MODELS)[number]["id"]
  >("selectedModel", SUPPORTED_MODELS[0].id);
  const [thinkingIntensity, setThinkingIntensity] =
    useLocalStorageState<ThinkingIntensity>("thinkingIntensity", "medium");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useLocalStorageState("sidebarOpen", false);

  const [filePreviewModal, setFilePreviewModal] =
    useState<FilePreviewModalState>({
      isOpen: false,
      messageId: null,
      fileName: "",
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Disable web search when switching to a thinking model that doesn't support both
  useEffect(() => {
    if (
      isThinkingModel(selectedModel) &&
      webSearchEnabled &&
      !supportsThinkingAndWebSearch(selectedModel)
    ) {
      setWebSearchEnabled(false);
    }
  }, [selectedModel, webSearchEnabled]);

  const truncateFileName = useCallback(
    (fileName: string, isCitation: boolean = false) => {
      const multiplier = isCitation ? 2 : 1;
      if (isMobile && fileName.length > MOBILE_FILENAME_TRUNCATION_THRESHOLD) {
        return (
          fileName.substring(
            0,
            multiplier * MOBILE_FILENAME_TRUNCATION_THRESHOLD,
          ) + "..."
        );
      } else if (
        !isMobile &&
        fileName.length > multiplier * DESKTOP_FILENAME_TRUNCATION_THRESHOLD
      ) {
        return (
          fileName.substring(
            0,
            multiplier * DESKTOP_FILENAME_TRUNCATION_THRESHOLD,
          ) + "..."
        );
      }
      return fileName;
    },
    [isMobile],
  );

  const messagesForSelectedConversation = useQuery(
    api.chatQueriesAndMutations.listMessages,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  );

  // Get conversation model settings to restore when switching conversations
  const conversationModelSettings = useQuery(
    api.chatQueriesAndMutations.getConversationModelSettings,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  );

  useEffect(() => {
    if (
      selectedConversationId &&
      selectedConversationId !== previousConversationIdRef.current
    ) {
      setIsLoadingConversation(true);
      shouldAutoScrollRef.current = true;
      previousConversationIdRef.current = selectedConversationId;
    }
    if (messagesForSelectedConversation !== undefined) {
      setIsLoadingConversation(false);
    }
  }, [selectedConversationId, messagesForSelectedConversation]);

  // Restore model settings when conversation model settings are loaded
  useEffect(() => {
    if (conversationModelSettings && selectedConversationId) {
      // Only restore if we haven't restored for this conversation yet
      // This allows users to change models mid-conversation without them being reset
      if (lastModelRestoredConversationRef.current !== selectedConversationId) {
        // Always restore model, defaulting to gpt-4.1 if not set
        setSelectedModel(
          (conversationModelSettings.model as (typeof SUPPORTED_MODELS)[number]["id"]) ??
            SUPPORTED_MODELS[0].id,
        );
        // Always restore thinking intensity, defaulting to medium if not set
        setThinkingIntensity(
          conversationModelSettings.thinkingIntensity ?? "medium",
        );
        // Always restore web search setting, defaulting to false if not set
        setWebSearchEnabled(
          conversationModelSettings.webSearchEnabled ?? false,
        );
        // Mark that we've restored settings for this conversation
        lastModelRestoredConversationRef.current = selectedConversationId;
      }
    }
  }, [
    conversationModelSettings,
    selectedConversationId,
    setSelectedModel,
    setThinkingIntensity,
  ]);

  const isAITyping = useMemo(() => {
    if (
      !messagesForSelectedConversation ||
      messagesForSelectedConversation.length === 0
    )
      return false;
    const lastMessage =
      messagesForSelectedConversation[
        messagesForSelectedConversation.length - 1
      ];
    return (
      lastMessage?.author === "user" ||
      (lastMessage?.author === "assistant" && lastMessage?.status === "typing")
    );
  }, [messagesForSelectedConversation]);

  useEffect(() => {
    if (
      selectedConversationId &&
      messagesForSelectedConversation !== undefined &&
      !isLoadingConversation &&
      shouldAutoScrollRef.current
    ) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      shouldAutoScrollRef.current = false;
    }
  }, [
    selectedConversationId,
    messagesForSelectedConversation,
    isLoadingConversation,
  ]);

  const isUploadingFiles = useMemo(
    () => selectedFiles.some((f) => f.status === "uploading"),
    [selectedFiles],
  );

  const handleCreateConversation = useCallback(async () => {
    try {
      const newConversationId = await createConversation({});
      setSelectedConversationId(newConversationId);
      void navigate({
        to: "/c/$conversationId",
        params: { conversationId: newConversationId },
      });
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to create new chat. Please try again.");
    }
  }, [createConversation, navigate]);

  const handleConversationSelect = useCallback(
    (id: Id<"conversations">) => {
      setSelectedConversationId(id);
      void navigate({
        to: "/c/$conversationId",
        params: { conversationId: id },
      });
    },
    [navigate],
  );

  const handleDeleteConversation = useCallback(
    async (id: Id<"conversations">) => {
      try {
        const result = deleteConversation({ conversationId: id });
        if (selectedConversationId === id) {
          setSelectedConversationId(null);
          void navigate({ to: "/" });
        }
        await result;
      } catch (err) {
        console.error("Failed to delete conversation", err);
        toast.error("Failed to delete chat. Please try again.");
      }
    },
    [deleteConversation, selectedConversationId, navigate],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const filesFromInput = event.target.files;
      if (filesFromInput) {
        const newRawFiles = Array.from(filesFromInput);
        const validTypeFiles = newRawFiles.filter((file) =>
          isSupportedFileType(file.type),
        );
        const validSizeFiles = validTypeFiles.filter(
          (file) => file.size <= MAX_FILE_SIZE,
        );
        const invalidTypeFiles = newRawFiles.filter(
          (file) => !isSupportedFileType(file.type),
        );
        const oversizedFiles = validTypeFiles.filter(
          (file) => file.size > MAX_FILE_SIZE,
        );
        if (invalidTypeFiles.length > 0) {
          toast.error(
            `Please select only ${SUPPORTED_FILE_TYPES.join(" or ").toUpperCase()} files.`,
          );
        }
        if (oversizedFiles.length > 0) {
          const oversizedNames = oversizedFiles.map((f) => f.name).join(", ");
          toast.error(`Files too large (max 10MB): ${oversizedNames}`);
        }
        if (selectedFiles.length + validSizeFiles.length > MAX_FILES) {
          toast.error(`You can upload a maximum of ${MAX_FILES} files.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        const newFileStates: SelectedFileState[] = validSizeFiles.map(
          (file) => ({
            uuid: crypto.randomUUID(),
            file,
            status: "pending",
          }),
        );
        setSelectedFiles((prev) => [...prev, ...newFileStates]);
        const uploadPromises = newFileStates.map(async (newFileState) => {
          setSelectedFiles((prev) =>
            prev.map((f) =>
              f.uuid === newFileState.uuid ? { ...f, status: "uploading" } : f,
            ),
          );
          try {
            const postUrl = await generateUploadUrl();
            const result = await fetch(postUrl, {
              method: "POST",
              headers: { "Content-Type": newFileState.file.type },
              body: newFileState.file,
            });
            const { storageId } = await result.json();
            setSelectedFiles((prev) =>
              prev.map((f) =>
                f.uuid === newFileState.uuid && f.status === "uploading"
                  ? { ...f, status: "uploaded", convexStorageId: storageId }
                  : f,
              ),
            );
            toast.success(`Uploaded ${newFileState.file.name}`);
          } catch (err) {
            console.error(`Failed to upload ${newFileState.file.name}:`, err);
            toast.error(`Failed to upload ${newFileState.file.name}`);
            setSelectedFiles((prev) =>
              prev.map((f) =>
                f.uuid === newFileState.uuid && f.status === "uploading"
                  ? {
                      ...f,
                      status: "error",
                      errorMessage: (err as Error).message,
                    }
                  : f,
              ),
            );
          }
        });
        await Promise.allSettled(uploadPromises);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [selectedFiles.length, generateUploadUrl],
  );

  const removeSelectedFile = useCallback((fileToRemove: SelectedFileState) => {
    setSelectedFiles((prevFiles) =>
      prevFiles.filter((f) => f.uuid !== fileToRemove.uuid),
    );
  }, []);

  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilePreview = useCallback(
    (messageId: Id<"messages">, fileName: string) => {
      setFilePreviewModal({ isOpen: true, messageId, fileName });
    },
    [],
  );

  const closeFilePreview = useCallback(() => {
    setFilePreviewModal({ isOpen: false, messageId: null, fileName: "" });
  }, []);

  // State for citation lookup
  const [citationLookup, setCitationLookup] = useState<{
    conversationId: Id<"conversations">;
    openaiFileId: string;
  } | null>(null);

  // Query to find user message by OpenAI file ID (only runs when citationLookup is set)
  const citationUserMessage = useQuery(
    api.chatQueriesAndMutations.findUserMessageByFileId,
    citationLookup
      ? {
          conversationId: citationLookup.conversationId,
          openaiFileId: citationLookup.openaiFileId,
        }
      : "skip",
  );

  // Effect to handle citation lookup result
  useEffect(() => {
    if (citationLookup && citationUserMessage !== undefined) {
      if (citationUserMessage) {
        // Open the file preview with the user message ID and file name
        setFilePreviewModal({
          isOpen: true,
          messageId: citationUserMessage.messageId,
          fileName: citationUserMessage.fileName,
        });
      } else {
        toast.error("File not found for citation");
      }
      // Reset the citation lookup
      setCitationLookup(null);
    }
  }, [citationLookup, citationUserMessage]);

  const handleCitationClick = useCallback(
    (conversationId: Id<"conversations">, openaiFileId: string) => {
      setCitationLookup({ conversationId, openaiFileId });
    },
    [],
  );

  const handleSubmit = useCallback(
    async (content: string) => {
      const currentMessageContent = content.trim();
      if (!currentMessageContent) {
        toast.error("Please type a message.");
        return;
      }
      if (isUploadingFiles) {
        toast.error("Files are still uploading. Please wait.");
        return;
      }

      // Load API keys from localStorage
      const apiKeys = loadApiKeysFromStorage();

      // Validate API key based on selected model
      if (isOpenRouterModel(selectedModel)) {
        if (!hasApiKey("openrouter")) {
          toast.error(
            "OpenRouter API key is required for this model. Please add it in Settings.",
          );
          return;
        }
      } else {
        if (!hasApiKey("openai")) {
          toast.error(
            "OpenAI API key is required for this model. Please add it in Settings.",
          );
          return;
        }
      }

      try {
        let conversationIdToUse = selectedConversationId;
        if (!conversationIdToUse) {
          conversationIdToUse = await createConversation({});
          setSelectedConversationId(conversationIdToUse);
          void navigate({
            to: "/c/$conversationId",
            params: { conversationId: conversationIdToUse },
          });
        }
        if (!conversationIdToUse) {
          toast.error("Failed to create or select a conversation.");
          return;
        }
        const textContent = currentMessageContent;
        const filesForAction = selectedFiles
          .filter((sf) => sf.status === "uploaded" && sf.convexStorageId)
          .map((sf) => ({
            storageId: sf.convexStorageId!,
            fileName: sf.file.name,
          }));

        if (filesForAction.length > 0) {
          // Detect user's IANA timezone
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const result = await uploadFileAndSendMessageAction({
            conversationId: conversationIdToUse,
            content: textContent,
            uploadedConvexFiles: filesForAction,
            webSearchEnabled: webSearchEnabled,
            model: selectedModel,
            thinkingIntensity: isThinkingModel(selectedModel)
              ? thinkingIntensity
              : undefined,
            timezone,
            openaiApiKey: apiKeys.openai || undefined,
            openrouterApiKey: apiKeys.openrouter || undefined,
          });
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error) => {
              toast.error(error);
            });
          }
        } else {
          // Detect user's IANA timezone
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await sendMessageAction({
            conversationId: conversationIdToUse,
            content: textContent,
            webSearchEnabled: webSearchEnabled,
            model: selectedModel,
            thinkingIntensity: isThinkingModel(selectedModel)
              ? thinkingIntensity
              : undefined,
            timezone,
            openaiApiKey: apiKeys.openai || undefined,
            openrouterApiKey: apiKeys.openrouter || undefined,
          });
        }
        setSelectedFiles([]);
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message. Please try again.");
      }
    },
    [
      isUploadingFiles,
      selectedConversationId,
      createConversation,
      selectedFiles,
      webSearchEnabled,
      selectedModel,
      thinkingIntensity,
      uploadFileAndSendMessageAction,
      sendMessageAction,
      navigate,
    ],
  );

  // Effect to watch for new error messages and show toasts with specific error details
  useEffect(() => {
    if (messagesForSelectedConversation) {
      // Check all messages for errors we haven't seen yet
      messagesForSelectedConversation.forEach((message) => {
        if (
          message.status === "error" &&
          message.errorDetails &&
          !seenErrorMessageIdsRef.current.has(message._id)
        ) {
          toast.error(message.errorDetails);
          seenErrorMessageIdsRef.current.add(message._id);
        }
      });

      lastMessageCountRef.current = messagesForSelectedConversation.length;
    }
  }, [messagesForSelectedConversation]);

  // Reset seen error messages when conversation changes
  useEffect(() => {
    if (selectedConversationId !== previousConversationIdRef.current) {
      seenErrorMessageIdsRef.current.clear();
      lastMessageCountRef.current = 0;
    }
  }, [selectedConversationId]);

  return {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    isLoadingConversation,
    messagesForSelectedConversation,
    isAITyping,
    isUploadingFiles,
    selectedFiles,
    removeSelectedFile,
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
    handleSubmit,
    handleConversationSelect,
    handleCreateConversation,
    handleDeleteConversation,
    truncateFileName,
    handleFilePreview,
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
    messagesEndRef,
    handleCitationClick,
  } as const;
}
