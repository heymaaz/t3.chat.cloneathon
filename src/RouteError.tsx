export function RouteError({ error }: { error: unknown }) {
  let message = "An unexpected error occurred";
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("not found")
  ) {
    message = "Conversation not found";
  }
  return (
    <div className="flex items-center justify-center p-8 text-muted-foreground dark:text-gray-300">
      {message}
    </div>
  );
}
