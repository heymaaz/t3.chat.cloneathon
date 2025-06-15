import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      void navigate({ to: "/" });
    } catch (error) {
      console.error("Sign out failed", error);
      toast.error("Sign out failed. Please try again.");
    }
  }, [navigate, signOut]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void handleSignOut();
      }}
      className="h-9"
    >
      Sign out
    </Button>
  );
}
