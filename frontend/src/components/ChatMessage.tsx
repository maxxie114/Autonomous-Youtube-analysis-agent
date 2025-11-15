import { ReactNode } from "react";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  children: ReactNode;
}

export const ChatMessage = ({ role, children }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-4 px-4 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500",
        isUser ? "bg-background" : "bg-secondary/30"
      )}
    >
      <div className="flex-shrink-0">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            isUser
              ? "bg-gradient-to-br from-muted to-muted-foreground/20"
              : "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4 text-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-white" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2 pt-1">
        {children}
      </div>
    </div>
  );
};
