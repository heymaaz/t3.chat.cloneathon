import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "@/styles/globals.css";
import App from "@/App";
import { ThemeProvider } from "./components/theme-provider";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <ThemeProvider defaultTheme="system" storageKey="t3-chat-clone-theme">
        <App />
      </ThemeProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);
