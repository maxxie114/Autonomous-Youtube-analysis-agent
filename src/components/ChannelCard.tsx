import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Video, Eye } from "lucide-react";

interface ChannelCardProps {
  name: string;
  subscribers: string;
  totalViews: string;
  videoCount: number;
  channelId: string;
  thumbnailUrl?: string;
}

export const ChannelCard = ({
  name,
  subscribers,
  totalViews,
  videoCount,
  channelId,
  thumbnailUrl,
}: ChannelCardProps) => {
  return (
    <Card className="group overflow-hidden border border-border/50 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={name}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all">
              <span className="text-lg font-bold text-primary">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground font-mono truncate mt-1">
              {channelId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Subscribers</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{subscribers}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Views</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{totalViews}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Video className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Videos</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{videoCount}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
