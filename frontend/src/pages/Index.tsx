import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/ChatMessage";
import { AgentWorkflow } from "@/components/AgentWorkflow";
import { ChannelCard } from "@/components/ChannelCard";
import { Send, Youtube, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  workflow?: Array<{
    id: string;
    label: string;
    status: "pending" | "active" | "complete";
    description?: string;
  }>;
  channels?: Array<{
    name: string;
    subscribers: string;
    totalViews: string;
    videoCount: number;
    channelId: string;
  }>;
}

const Index = () => {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    // Create assistant message with workflow
    const assistantMessageId = (Date.now() + 1).toString();
    const workflowSteps = [
      { id: "1", label: "Analyzing query", status: "pending" as const },
      { id: "2", label: "Searching YouTube", status: "pending" as const },
      { id: "3", label: "Fetching statistics", status: "pending" as const },
      { id: "4", label: "Formatting results", status: "pending" as const },
    ];

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "Let me analyze that for you...",
        workflow: workflowSteps,
      },
    ]);

    // Simulate workflow progression
    for (let i = 0; i < workflowSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId && msg.workflow) {
            const updatedWorkflow = [...msg.workflow];
            updatedWorkflow[i] = {
              ...updatedWorkflow[i],
              status: "active",
            };
            return { ...msg, workflow: updatedWorkflow };
          }
          return msg;
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId && msg.workflow) {
            const updatedWorkflow = [...msg.workflow];
            updatedWorkflow[i] = {
              ...updatedWorkflow[i],
              status: "complete",
              description: "Completed successfully",
            };
            return { ...msg, workflow: updatedWorkflow };
          }
          return msg;
        })
      );
    }

    // Add results
    const mockChannels = [
      {
        name: "Fireship",
        subscribers: "3.2M",
        totalViews: "245M",
        videoCount: 450,
        channelId: "UCsBjURrPoezykLs9EqgamOA",
      },
      {
        name: "Web Dev Simplified",
        subscribers: "1.5M",
        totalViews: "120M",
        videoCount: 380,
        channelId: "UCFbNIlppjAuEX4znoulh0Cw",
      },
      {
        name: "Traversy Media",
        subscribers: "2.1M",
        totalViews: "180M",
        videoCount: 920,
        channelId: "UC29ju8bIPH5as8OGnQzwJyA",
      },
    ];

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === assistantMessageId) {
          return {
            ...msg,
            content: `I found ${mockChannels.length} channels matching your query. Here are the results:`,
            channels: mockChannels,
          };
        }
        return msg;
      })
    );

    setIsProcessing(false);
    
    toast({
      title: "Search complete",
      description: `Found ${mockChannels.length} channels`,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-lg sticky top-0 z-50 flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Youtube className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">YouTube Agent</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Channel Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Self-Evolving AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-4xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-16">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/20 mb-6">
                <Youtube className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                YouTube Agent
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-8">
                Search and analyze YouTube channels with AI. Ask me anything about content creators!
              </p>
              <div className="grid gap-3 w-full max-w-2xl">
                <button
                  onClick={() => setInput("Find tech channels with 100k-500k subscribers")}
                  className="px-4 py-3 text-sm text-left rounded-lg border border-border/50 hover:border-primary/50 hover:bg-secondary/30 transition-all"
                >
                  Find tech channels with 100k-500k subscribers
                </button>
                <button
                  onClick={() => setInput("Show me python programming channels")}
                  className="px-4 py-3 text-sm text-left rounded-lg border border-border/50 hover:border-primary/50 hover:bg-secondary/30 transition-all"
                >
                  Show me python programming channels
                </button>
                <button
                  onClick={() => setInput("Find channels focused on web development tutorials")}
                  className="px-4 py-3 text-sm text-left rounded-lg border border-border/50 hover:border-primary/50 hover:bg-secondary/30 transition-all"
                >
                  Find channels focused on web development tutorials
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} role={message.role}>
                  <p className="text-foreground whitespace-pre-wrap">{message.content}</p>
                  
                  {message.workflow && (
                    <div className="mt-4">
                      <AgentWorkflow steps={message.workflow} />
                    </div>
                  )}
                  
                  {message.channels && message.channels.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {message.channels.map((channel) => (
                        <ChannelCard key={channel.channelId} {...channel} />
                      ))}
                    </div>
                  )}
                </ChatMessage>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border/40 bg-background/80 backdrop-blur-lg flex-shrink-0">
        <div className="container mx-auto max-w-4xl px-4 py-4">
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about YouTube channels... (Press Enter to send, Shift+Enter for new line)"
              className="min-h-[60px] max-h-[200px] pr-12 resize-none bg-secondary/30 border-border/50 focus:border-primary/50 transition-colors"
              disabled={isProcessing}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isProcessing}
              className="absolute right-2 bottom-2 h-8 w-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              {isProcessing ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            YouTube Agent can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
