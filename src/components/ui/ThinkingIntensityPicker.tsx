import { Button } from "@/components/ui/button";
import { Brain, ChevronDown } from "lucide-react";
import {
  THINKING_INTENSITY_LEVELS,
  type ThinkingIntensity,
} from "@backend/constants";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ThinkingIntensityPickerProps {
  selectedIntensity: ThinkingIntensity;
  onIntensityChange: (intensity: ThinkingIntensity) => void;
  disabled?: boolean;
}

export function ThinkingIntensityPicker({
  selectedIntensity,
  onIntensityChange,
  disabled,
}: ThinkingIntensityPickerProps) {
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
      const selectedIndex = THINKING_INTENSITY_LEVELS.findIndex(
        (i) => i === selectedIntensity,
      );
      setFocusedIndex(selectedIndex > -1 ? selectedIndex : 0);
    }
  }, [isOpen, selectedIntensity]);

  const getIntensityLabel = (intensity: ThinkingIntensity) => {
    return intensity.charAt(0).toUpperCase() + intensity.slice(1);
  };

  const getIntensityIcon = (intensity: ThinkingIntensity) => {
    switch (intensity) {
      case "high":
        return <Brain className="h-5 w-5 stroke-[3]" />;
      case "medium":
        return <Brain className="h-5 w-5 stroke-2" />;
      case "low":
        return <Brain className="h-5 w-5 stroke-1" />;
    }
  };

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
          (prev + direction + THINKING_INTENSITY_LEVELS.length) %
          THINKING_INTENSITY_LEVELS.length,
      );
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (isOpen && focusedIndex !== -1) {
        onIntensityChange(THINKING_INTENSITY_LEVELS[focusedIndex]);
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
      aria-label="Thinking intensity picker"
    >
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium text-primary hover:text-primary"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {getIntensityIcon(selectedIntensity)}
        <span className="hidden md:block">
          {getIntensityLabel(selectedIntensity)}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </Button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 min-w-32 bg-background border border-border rounded-md shadow-lg z-50"
          role="listbox"
          aria-activedescendant={
            focusedIndex > -1 ? `intensity-option-${focusedIndex}` : undefined
          }
        >
          <div className="py-1">
            {THINKING_INTENSITY_LEVELS.map((intensity, index) => (
              <button
                key={intensity}
                id={`intensity-option-${index}`}
                role="option"
                aria-selected={selectedIntensity === intensity}
                onClick={() => {
                  onIntensityChange(intensity);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-3",
                  focusedIndex === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {getIntensityIcon(intensity)}
                <span>{getIntensityLabel(intensity)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
