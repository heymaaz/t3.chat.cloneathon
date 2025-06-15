import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@backend/_generated/api";
import type { Id } from "@backend/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Download,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: Id<"messages">;
  fileName: string;
}

// Function to determine file type based on extension
const getFileType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "txt") {
    return "text";
  }

  if (ext === "pdf") {
    return "pdf";
  }

  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    return "office";
  }

  return "unsupported";
};

// Function to detect mobile devices (including iPadOS which masquerades as desktop)
const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    "mobile",
    "android",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
  ];

  // Check user agent for explicit mobile indicators
  const isMobileUserAgent = mobileKeywords.some((keyword) =>
    userAgent.includes(keyword),
  );

  // Special detection for iPadOS (which tries to look like macOS Safari)
  const isIPadOS = (() => {
    // iPadOS 13+ tries to masquerade as macOS, so we need multiple checks
    const platform = navigator.platform || "";
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    // Direct iPad detection
    if (platform.includes("iPad") || userAgent.includes("ipad")) {
      return true;
    }

    // iPadOS 13+ detection: looks like Mac but has touch support
    const isMacLike =
      platform.includes("Mac") || userAgent.includes("mac os x");
    const hasTouch = maxTouchPoints > 1; // iPads typically have 5+ touch points

    return isMacLike && hasTouch;
  })();

  // Check screen width as additional indicator for smaller devices
  const isMobileScreen = window.innerWidth <= 768;

  // Check for touch support
  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Return true if any mobile indicators are found, including iPadOS
  return isMobileUserAgent || isIPadOS || (isMobileScreen && isTouchDevice);
};

// Available worker sources in order of preference (only used for mobile)
const WORKER_SOURCES = [
  // UNPKG with module resolution
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
  // JSDelivr as fallback
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
  // CDNJS as final fallback (uses .js extension which sometimes works better)
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`,
];

export function FilePreviewModal({
  isOpen,
  onClose,
  messageId,
  fileName,
}: FilePreviewModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [fileData, setFileData] = useState<{
    fileName: string;
    fileType: string;
    fileSize: number;
    downloadUrl: string | null;
    content: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfLoadingError, setPdfLoadingError] = useState<string | null>(null);

  // REFINEMENT 1: Manage worker state within the component
  const [workerIndex, setWorkerIndex] = useState(0);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SOURCES[workerIndex];

  // REFINEMENT 2: State and ref for responsive width
  const [pageWidth, setPageWidth] = useState(300);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Memoize mobile detection to prevent unnecessary re-renders
  const isMobile = useMemo(() => isMobileDevice(), []);

  const getFileForPreview = useAction(api.filePreview.getFileForPreview);

  // Memoize PDF.js options to prevent unnecessary reloads (only for mobile)
  const pdfOptions = useMemo(
    () => ({
      // Additional options for better compatibility
      verbosity: 1, // Enable some logging to help debug issues
      isEvalSupported: false,
      isOffscreenCanvasSupported: false,
      // Disable standard font mapping which can cause issues
      standardFontDataUrl: undefined,
    }),
    [],
  );

  const loadFileData = useCallback(async () => {
    setError(null);
    setPdfLoadingError(null);

    try {
      const data = await getFileForPreview({ messageId, fileName });
      if (data) {
        setFileData(data);
      } else {
        setError("File not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    }
  }, [getFileForPreview, messageId, fileName]);

  const handleClose = useCallback(() => {
    // Reset all state when closing
    setFileData(null);
    setError(null);
    setIsDownloading(false);
    setNumPages(null);
    setPageNumber(1);
    setPdfLoadingError(null);
    setWorkerIndex(0); // Reset worker index on close
    onClose();
  }, [onClose]);

  // REFINEMENT 2: Effect to measure container width for responsive PDF pages
  useEffect(() => {
    if (pdfContainerRef.current) {
      // Set a timeout to allow the dialog to render and get the correct width
      setTimeout(() => {
        if (pdfContainerRef.current) {
          setPageWidth(pdfContainerRef.current.clientWidth);
        }
      }, 100);
    }
  }, [isOpen]); // Rerun when the modal opens

  // Load file data when modal opens
  useEffect(() => {
    if (isOpen && !fileData) {
      void loadFileData();
    }
  }, [isOpen, fileData, loadFileData]);

  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
  const fileType = getFileType(fileName);

  const handleDownload = useCallback(async () => {
    if (!fileData?.downloadUrl) {
      toast.error("Download URL not available");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(fileData.downloadUrl);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  }, [fileData?.downloadUrl, fileName]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const renderPdfPreview = () => {
    if (!fileData?.downloadUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] border rounded-md bg-muted/20">
          <FileText className="h-16 w-16 text-muted-foreground dark:text-gray-300 mb-4" />
          <p className="text-sm text-muted-foreground dark:text-gray-300 mb-2">
            PDF Preview
          </p>
          <p className="text-xs text-muted-foreground dark:text-gray-300 text-center mb-4">
            Download URL not available for this PDF file.
          </p>
        </div>
      );
    }

    // Desktop: Use native browser PDF viewer
    if (!isMobile) {
      return (
        <div className="h-[70vh] w-full rounded-md border overflow-hidden">
          <iframe
            src={fileData.downloadUrl}
            title={fileName}
            width="100%"
            height="100%"
            style={{ border: "none" }}
            onError={() => {
              setError(
                "Failed to load PDF in browser viewer. Try downloading the file.",
              );
            }}
          />
        </div>
      );
    }

    // Mobile: Use react-pdf with pagination
    if (pdfLoadingError) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] border rounded-md bg-muted/20">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <p className="text-sm text-destructive mb-2">Error loading PDF</p>
          <p className="text-xs text-muted-foreground dark:text-gray-300 text-center mb-4">
            {pdfLoadingError}
          </p>
          <Button
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            className="mt-4"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center w-full">
        {numPages && numPages > 1 && (
          <div className="flex items-center justify-center gap-4 p-2 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}
        <div
          ref={pdfContainerRef}
          className="h-[70vh] w-full max-h-[60vh] md:max-h-[70vh] rounded-md border overflow-y-auto flex justify-center"
        >
          <Document
            file={fileData.downloadUrl}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setPageNumber(1);
              setPdfLoadingError(null);
            }}
            onLoadError={(err) => {
              // REFINEMENT 1: Handle worker errors by updating state
              if (
                err.message.includes("worker") &&
                workerIndex < WORKER_SOURCES.length - 1
              ) {
                // Simply update the index. React will re-render with the new workerSrc.
                setWorkerIndex((prevIndex) => prevIndex + 1);
              } else {
                setPdfLoadingError(
                  "Failed to load PDF preview. You can still download the file.",
                );
              }
            }}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center h-full p-4">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm text-destructive mb-2">
                  Error loading PDF
                </p>
                <Button
                  onClick={() => {
                    setPdfLoadingError(null);
                    void loadFileData();
                  }}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            }
            options={pdfOptions}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              className="w-full h-full"
              renderTextLayer={true}
              renderAnnotationLayer={false}
              onLoadError={() => {
                setPdfLoadingError(`Failed to load page ${pageNumber}`);
              }}
            />
          </Document>
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] border rounded-md bg-muted/20">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <p className="text-sm text-destructive mb-2">Error loading file</p>
          <p className="text-xs text-muted-foreground dark:text-gray-300 text-center">
            {error}
          </p>
        </div>
      );
    }

    if (!fileData) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] border rounded-md bg-muted/20">
          <AlertCircle className="h-16 w-16 text-muted-foreground dark:text-gray-300 mb-4" />
          <p className="text-sm text-muted-foreground dark:text-gray-300">
            No file data available
          </p>
        </div>
      );
    }

    // Handle different file types
    switch (fileType) {
      case "text":
        if (fileData.content) {
          return (
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {fileData.content}
              </pre>
            </ScrollArea>
          );
        }
        break;

      case "pdf":
        return renderPdfPreview();

      case "office":
        if (fileData.downloadUrl) {
          const officeViewerUrl = new URL(
            "https://view.officeapps.live.com/op/embed.aspx",
          );
          officeViewerUrl.searchParams.set("src", fileData.downloadUrl);
          officeViewerUrl.searchParams.set("wdMobileView", "true");

          return (
            <div className="h-[70vh] w-full rounded-md border overflow-hidden">
              <iframe
                src={officeViewerUrl.toString()}
                title={fileName}
                width="100%"
                height="100%"
                style={{ border: "none" }}
              />
            </div>
          );
        } else {
          return (
            <div className="flex flex-col items-center justify-center h-[400px] border rounded-md bg-muted/20">
              <FileText className="h-16 w-16 text-muted-foreground dark:text-gray-300 mb-4" />
              <p className="text-sm text-muted-foreground dark:text-gray-300 mb-2">
                Office Document Preview
              </p>
              <p className="text-xs text-muted-foreground dark:text-gray-300 text-center mb-4">
                Download URL not available for this Office file.
              </p>
            </div>
          );
        }
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[400px] border rounded-md bg-muted/20">
            <FileText className="h-16 w-16 text-muted-foreground dark:text-gray-300 mb-4" />
            <p className="text-sm text-muted-foreground dark:text-gray-300 mb-2">
              Preview not available
            </p>
            <p className="text-xs text-muted-foreground dark:text-gray-300 text-center">
              File type .{fileExtension} is not supported for preview
            </p>
            {fileData.downloadUrl && (
              <Button
                onClick={() => void handleDownload()}
                disabled={isDownloading}
                className="mt-4"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download File
              </Button>
            )}
          </div>
        );
    }
  };

  const getFileTypeDisplayName = (type: string) => {
    switch (type) {
      case "text":
        return "Text";
      case "pdf":
        return "PDF";
      case "office":
        return "Office Document";
      default:
        return "File";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={`max-w-4xl ${fileType === "office" ? "max-h-[95vh]" : "max-h-[90vh]"} flex flex-col overflow-y-auto`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {fileName}
          </DialogTitle>
          <DialogDescription>
            {getFileTypeDisplayName(fileType)}
            {fileData && ` • ${formatFileSize(fileData.fileSize)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">{renderPreview()}</div>

        <div className="flex justify-end items-center pt-4 border-t">
          <div className="flex gap-2">
            {fileData?.downloadUrl && (
              <Button
                variant="outline"
                onClick={() => void handleDownload()}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download
              </Button>
            )}
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
