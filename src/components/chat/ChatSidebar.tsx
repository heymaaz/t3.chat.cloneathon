import { memo, useMemo } from "react";
import { Sidebar, SidebarItem } from "@/components/ui/sidebar/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import type { Id, Doc } from "@backend/_generated/dataModel";

type Conversation = Doc<"conversations">;

function getTimeGroup(creationTime: number, updatedTime?: number) {
  const activityTime = updatedTime ?? creationTime;
  const messageDate = new Date(activityTime);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (messageDate >= todayStart) {
    return "Today";
  } else if (messageDate >= yesterdayStart) {
    return "Yesterday";
  } else if (messageDate >= sevenDaysAgo) {
    return "Last 7 Days";
  } else if (messageDate >= thirtyDaysAgo) {
    return "Last 30 Days";
  } else {
    return "Older";
  }
}

function groupConversationsByTime(conversations: Conversation[]) {
  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 Days": [],
    "Last 30 Days": [],
    Older: [],
  };

  conversations.forEach((conv) => {
    const group = getTimeGroup(conv._creationTime, conv.updatedTime);
    groups[group].push(conv);
  });

  return Object.entries(groups).filter(([_, convs]) => convs.length > 0);
}

export interface ChatSidebarProps {
  conversations: Conversation[] | undefined;
  selectedConversationId: Id<"conversations"> | null;
  onConversationSelect: (id: Id<"conversations">) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: Id<"conversations">) => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatSidebar = memo(
  ({
    conversations,
    selectedConversationId,
    onConversationSelect,
    onCreateConversation,
    onDeleteConversation,
    isOpen,
    setIsOpen,
  }: ChatSidebarProps) => {
    const groupedConversations = useMemo(() => {
      if (!conversations || conversations.length === 0) return [];
      return groupConversationsByTime(conversations);
    }, [conversations]);

    return (
      <Sidebar
        className="border-r border-border z-40"
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      >
        <div className="p-3 border-b">
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground"
            onClick={onCreateConversation}
          >
            <Plus className="h-4 w-4 mr-2" />
            New chat
          </Button>
        </div>
        <div className="p-2">
          {groupedConversations.length > 0 ? (
            <div className="space-y-4">
              {groupedConversations.map(([groupName, groupConversations]) => (
                <div key={groupName} className="space-y-1">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    {groupName}
                  </h3>
                  <div className="space-y-1">
                    {groupConversations.map((conv) => {
                      const isSelected = selectedConversationId === conv._id;
                      const conversationTitle = conv.name
                        ? conv.name.replace(/^"|"$/g, "")
                        : "Unnamed Chat";
                      return (
                        <div key={conv._id} className="group relative">
                          <SidebarItem
                            title={conversationTitle}
                            isActive={isSelected}
                            onClick={() => onConversationSelect(conv._id)}
                          >
                            <button
                              className="absolute right-2 opacity-0 group-hover:opacity-100 transition-none p-1 rounded hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConversation(conv._id);
                              }}
                              title="Delete chat"
                            >
                              <Trash className="h-4 w-4 text-destructive" />
                            </button>
                          </SidebarItem>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                Chats
              </h3>
              <div className="text-xs text-muted-foreground px-2">
                No chats yet.
              </div>
            </div>
          )}
        </div>
      </Sidebar>
    );
  },
);

ChatSidebar.displayName = "ChatSidebar";
export default ChatSidebar;
