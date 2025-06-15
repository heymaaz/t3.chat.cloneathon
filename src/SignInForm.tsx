import { useAuthActions } from "@convex-dev/auth/react";
import { FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handlePasswordSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitting(true);
      const formData = new FormData(e.target as HTMLFormElement);
      formData.set("flow", flow);
      try {
        await signIn("password", formData);
        void navigate({ to: "/" });
      } catch (error: any) {
        let toastTitle = "";
        if (error.message.includes("Invalid password")) {
          toastTitle = "Invalid password. Please try again.";
        } else {
          toastTitle =
            flow === "signIn"
              ? "Could not sign in, did you mean to sign up?"
              : "Could not sign up, did you mean to sign in?";
        }
        toast.error(toastTitle);
        setSubmitting(false);
      }
    },
    [flow, navigate, signIn],
  );

  const handleAnonymousSignIn = useCallback(async () => {
    setSubmitting(true);
    try {
      await signIn("anonymous");
      void navigate({ to: "/" });
    } catch (error) {
      toast.error("Could not sign in anonymously, please try again.");
      setSubmitting(false);
      console.error(error);
    }
  }, [navigate, signIn]);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          void handlePasswordSubmit(e);
        }}
      >
        <Input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="h-11 text-foreground"
          autoComplete="email"
        />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="h-11 text-foreground"
          autoComplete="current-password"
        />
        <Button type="submit" disabled={submitting} className="w-full h-11">
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </Button>
        <div className="text-center text-sm text-muted-foreground dark:text-gray-300">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto min-w-0"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </Button>
        </div>
      </form>
      <div className="flex items-center justify-center my-4">
        <hr className="grow border-border" />
        <span className="mx-4 text-muted-foreground dark:text-gray-300">
          or
        </span>
        <hr className="grow border-border" />
      </div>
      <Button
        variant="outline"
        className="w-full h-11"
        disabled={submitting}
        onClick={() => {
          void handleAnonymousSignIn();
        }}
      >
        Sign in anonymously
      </Button>
    </div>
  );
}
