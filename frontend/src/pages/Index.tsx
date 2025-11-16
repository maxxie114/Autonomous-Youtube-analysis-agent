import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/ChatMessage";
import { AgentWorkflow } from "@/components/AgentWorkflow";
import { ChannelCard } from "@/components/ChannelCard";
import { Send, Youtube, Sparkles, Plus, ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { aceService } from "@/services/aceService";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
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
  const [showCreateImageTab, setShowCreateImageTab] = useState(false);
  const [showImageUploadAction, setShowImageUploadAction] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        setShowImageUploadAction(true);
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a valid image file.",
        variant: "destructive"
      });
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePlusButtonClick = () => {
    setShowCreateImageTab((prev) => {
      const next = !prev;
      if (!next) {
        setShowImageUploadAction(false);
      }
      return next;
    });
  };

  const handleCreateImageClick = () => {
    setShowImageUploadAction(true);
    setShowCreateImageTab(false);
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!input.trim() && !uploadedImage) || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || "[Image uploaded]",
      image: uploadedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput("");
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsProcessing(true);

    // Create assistant message with initial workflow
    const assistantMessageId = (Date.now() + 1).toString();

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "Let me analyze that for you...",
        workflow: [],
      },
    ]);

    try {
      // Call ACE agent service
      const response = await aceService.streamRequest(
        { 
          prompt: userInput,
          image: uploadedImage || undefined
        },
        (workflow) => {
          // Update workflow in real-time
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return { ...msg, workflow };
              }
              return msg;
            })
          );
        }
      );

      // Update final response
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              content: response.content,
              channels: response.channels,
              workflow: response.workflow,
            };
          }
          return msg;
        })
      );

      toast({
        title: "Analysis complete",
        description: response.channels ? `Found ${response.channels.length} channels` : "Response generated",
      });
    } catch (error) {
      console.error('Error getting response:', error);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              content: "Sorry, I encountered an error while processing your request. Please try again.",
              workflow: undefined,
            };
          }
          return msg;
        })
      );

      toast({
        title: "Error",
        description: "Failed to get response from agent",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
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
                  {message.image && (
                    <div className="mb-3">
                      <img
                        src={message.image}
                        alt="User uploaded"
                        className="max-w-sm max-h-64 rounded-lg border border-border/20 shadow-sm"
                      />
                    </div>
                  )}
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
            <div className="space-y-3">
              {uploadedImage && (
                <div className="relative inline-block p-2 bg-secondary/20 rounded-lg border border-border/30">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="max-w-xs max-h-32 rounded-md border border-border/20"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {showCreateImageTab && (
                <div className="mb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3 py-1 bg-background/40 hover:bg-background/60 border border-border/30"
                    onClick={handleCreateImageClick}
                    disabled={isProcessing}
                  >
                    Create image
                  </Button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center gap-3 rounded-full border border-border/50 bg-secondary/30 px-3 py-2 transition-colors focus-within:border-primary/50">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-full hover:bg-secondary/50"
                      onClick={handlePlusButtonClick}
                      disabled={isProcessing}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    {showImageUploadAction && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full hover:bg-secondary/50"
                        onClick={handleImageButtonClick}
                        disabled={isProcessing}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={uploadedImage ? "Describe what you want to know about this image..." : "Ask anything..."}
                    className="flex-1 min-h-[48px] max-h-[160px] resize-none border-0 bg-transparent px-0 py-3 text-base focus-visible:ring-0 focus-visible:outline-none placeholder:flex placeholder:items-center placeholder:text-lg"
                    disabled={isProcessing}
                  />

                  <Button
                    type="submit"
                    size="icon"
                    disabled={(!input.trim() && !uploadedImage) || isProcessing}
                    className="h-9 w-9 rounded-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
                  >
                    {isProcessing ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </form>
            </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            YouTube Agent can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
