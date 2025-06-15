import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { SUPPORTED_MODELS } from "@backend/constants";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Globe, Brain, FileText, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface ModelPickerProps {
  selectedModel: (typeof SUPPORTED_MODELS)[number];
  onModelChange: (model: (typeof SUPPORTED_MODELS)[number]) => void;
  disabled?: boolean;
}

export function ModelPicker({
  selectedModel,
  onModelChange,
  disabled,
}: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = dropdownRef.current;
    if (!node) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const selectedIndex = SUPPORTED_MODELS.findIndex(
        (m) => m.id === selectedModel.id,
      );
      setFocusedIndex(selectedIndex > -1 ? selectedIndex : 0);
    }
  }, [isOpen, selectedModel]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setFocusedIndex(
        (prev) =>
          (prev + direction + SUPPORTED_MODELS.length) %
          SUPPORTED_MODELS.length,
      );
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (isOpen && focusedIndex !== -1) {
        onModelChange(SUPPORTED_MODELS[focusedIndex]);
        setIsOpen(false);
        buttonRef.current?.focus();
      } else {
        setIsOpen(true);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      aria-label="Model picker"
    >
      <Button
        id="model-picker-trigger"
        ref={buttonRef}
        type="button"
        variant="ghost"
        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium text-primary hover:text-primary"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedModel.name}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </Button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 min-w-48 bg-background border border-border rounded-md shadow-lg z-50"
          role="listbox"
          aria-label="Model picker"
          aria-labelledby="model-picker-trigger"
          aria-activedescendant={
            focusedIndex > -1 ? `model-option-${focusedIndex}` : undefined
          }
        >
          <div className="py-1">
            {SUPPORTED_MODELS.map((model, index) => (
              <button
                key={model.id}
                id={`model-option-${index}`}
                role="option"
                aria-selected={selectedModel.id === model.id}
                onClick={() => {
                  onModelChange(model);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between",
                  focusedIndex === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {/* Tooltip for description */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                      <span>{model.name}</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 opacity-50" />
                        </TooltipTrigger>
                        <TooltipContent>{model.description}</TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                </div>
                {/* Tooltips for icons */}
                <div className="flex items-center gap-2">
                  {/* Add tooltips to the icons */}
                  {model.thinking && (
                    <span className="text-xs">
                      <Tooltip>
                        <TooltipTrigger>
                          <Brain className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                        </TooltipTrigger>
                        <TooltipContent>Thinking</TooltipContent>
                      </Tooltip>
                    </span>
                  )}
                  {model.webSearch && (
                    <span className="text-xs">
                      <Tooltip>
                        <TooltipTrigger>
                          <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        </TooltipTrigger>
                        <TooltipContent>Web Search</TooltipContent>
                      </Tooltip>
                    </span>
                  )}
                  {model.fileSearch && (
                    <span className="text-xs">
                      <Tooltip>
                        <TooltipTrigger>
                          <FileText className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                        </TooltipTrigger>
                        <TooltipContent>File Search</TooltipContent>
                      </Tooltip>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
