import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@backend/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DangerZone() {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loggedInUser = useQuery(api.auth.loggedInUser);
  const conversations = useQuery(api.chatQueriesAndMutations.listConversations);
  const deleteConversation = useMutation(
    api.chatQueriesAndMutations.deleteConversation,
  );

  const conversationCount = conversations?.length || 0;
  const confirmationPhrase = "DELETE ALL CHATS";
  const isConfirmationValid = confirmationText === confirmationPhrase;

  const handleDeleteAllChats = async () => {
    if (!isConfirmationValid || !conversations) return;

    setIsDeleting(true);
    try {
      // Delete all conversations one by one
      const deletePromises = conversations.map((conversation) =>
        deleteConversation({ conversationId: conversation._id }),
      );

      await Promise.all(deletePromises);

      toast.success("All chats deleted successfully");
      setIsDialogOpen(false);
      setConfirmationText("");
    } catch (error) {
      console.error("Error deleting chats:", error);
      toast.error("Failed to delete some chats. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Don't show danger zone for anonymous users
  if (loggedInUser?.isAnonymous) {
    return null;
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently delete all your chat conversations. This action cannot be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">Delete all chats</p>
            <p className="text-xs text-muted-foreground">
              {conversationCount === 0
                ? "No chats to delete"
                : `This will permanently delete ${conversationCount} conversation${conversationCount === 1 ? "" : "s"}`}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={conversationCount === 0}
              >
                <Trash2 className="h-4 w-4" />
                Delete All Chats
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Delete All Chats
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>
                    This will permanently delete all {conversationCount} of your
                    chat conversations. This action cannot be undone.
                  </p>
                  <p className="font-medium">
                    To confirm, type "{confirmationPhrase}" below:
                  </p>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="confirmation">Confirmation</Label>
                  <Input
                    id="confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={confirmationPhrase}
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setConfirmationText("");
                    }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDeleteAllChats()}
                    disabled={!isConfirmationValid || isDeleting}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete All Chats"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
