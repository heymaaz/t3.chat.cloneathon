import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@backend/_generated/api";
import { SignInForm } from "@/SignInForm";
import { SignOutButton } from "@/SignOutButton";
import { Toaster } from "sonner";
import { Loader2, Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "@/components/use-theme";
import { Button } from "@/components/ui/button";
import { useLocation } from "@tanstack/react-router";
import React from "react";

function Content({ children }: { children: React.ReactNode }) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex flex-1 justify-center items-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <>
      <Unauthenticated>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md mx-auto flex flex-col gap-8">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 lowercase">
                t3 chat clone
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground dark:text-gray-300">
                Sign in to get started
              </p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        {loggedInUser ? children : <p>Loading user...</p>}
      </Authenticated>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  // Check if we're on the settings page
  const isSettingsPage = location.pathname === "/settings";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Only show header if not on settings page */}
      {!isSettingsPage && (
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xs h-16 flex justify-between items-center border-b shadow-xs px-4">
          <div className="w-12 md:w-0"></div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              type="button"
            >
              {theme === "light" ? (
                <Sun className="h-5 w-5" />
              ) : theme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Laptop className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <SignOutButton />
          </div>
        </header>
      )}
      <main className="flex-1 flex flex-col">
        <Content>{children}</Content>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
