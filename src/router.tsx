import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/routerConfig";

export function AppRouter() {
  return <RouterProvider router={router} />;
}
