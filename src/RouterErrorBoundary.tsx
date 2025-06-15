import { RouteError } from "@/RouteError";

export function RouterErrorBoundary({ error }: { error: unknown }) {
  // Pure component - no side effects, just render the error
  return <RouteError error={error} />;
}
