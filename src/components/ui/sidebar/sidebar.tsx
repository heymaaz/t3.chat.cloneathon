import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({
  className,
  children,
  isOpen,
  setIsOpen,
  ...props
}: SidebarProps) {
  // Handle closing sidebar on resize to larger screen
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, setIsOpen]);

  return (
    <>
      {/* Overlay - only show on smaller screens (mobile) */}
      {isOpen && window.innerWidth <= 768 && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Toggle button (Hamburger) */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-background transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className,
        )}
        {...props}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className={cn("flex items-center")}>
            {/* Removed the title from here */}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </aside>
    </>
  );
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  isActive?: boolean;
  children?: React.ReactNode;
}

export const SidebarItem = React.memo(function SidebarItem({
  icon,
  title,
  isActive,
  children,
  className,
  ...props
}: SidebarItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-none",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-accent/50 hover:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{title}</span>
      {children}
    </div>
  );
});

SidebarItem.displayName = "SidebarItem";
