import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import ChatPage from "@/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import { RouterErrorBoundary } from "@/RouterErrorBoundary";
import { toast } from "sonner";
import { Root } from "./Root";

const rootRoute = createRootRoute({
  component: Root,
  errorComponent: RouterErrorBoundary,
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ChatPage,
});

export const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/c/$conversationId",
  component: ChatPage,
  errorComponent: ({ error }: { error: unknown }) => {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("not found")
    ) {
      toast.error("Conversation not found");
      // Use void to ignore promise
      void router.navigate({ to: "/" });
    }
    return <RouterErrorBoundary error={error} />;
  },
});

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  conversationRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
