var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Tool, ToolContext } from '@frontmcp/sdk';
import { z } from 'zod';
const ChannelStatisticsSchema = z.object({
    channelId: z.string(),
    title: z.string(),
    description: z.string(),
    customUrl: z.string().optional(),
    publishedAt: z.string(),
    thumbnails: z.object({
        default: z.string().optional(),
        medium: z.string().optional(),
        high: z.string().optional()
    }).optional(),
    statistics: z.object({
        viewCount: z.string(),
        subscriberCount: z.string(),
        hiddenSubscriberCount: z.boolean(),
        videoCount: z.string()
    }),
    brandingSettings: z.object({
        channel: z.object({
            title: z.string().optional(),
            description: z.string().optional(),
            keywords: z.string().optional(),
            defaultLanguage: z.string().optional(),
            country: z.string().optional()
        }).optional()
    }).optional(),
    contentDetails: z.object({
        relatedPlaylists: z.object({
            uploads: z.string().optional(),
            watchHistory: z.string().optional(),
            watchLater: z.string().optional()
        }).optional()
    }).optional()
});
const RecentVideosSchema = z.object({
    videoId: z.string(),
    title: z.string(),
    description: z.string(),
    publishedAt: z.string(),
    thumbnails: z.object({
        default: z.string().optional(),
        medium: z.string().optional(),
        high: z.string().optional()
    }).optional(),
    statistics: z.object({
        viewCount: z.string().optional(),
        likeCount: z.string().optional(),
        commentCount: z.string().optional()
    }).optional(),
    duration: z.string().optional()
});
let YouTubeChannelAnalysisTool = class YouTubeChannelAnalysisTool extends ToolContext {
    getApiKey() {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            throw new Error('YOUTUBE_API_KEY environment variable is not set');
        }
        return apiKey;
    }
    async execute(input) {
        try {
            // Step 1: Resolve channel ID if needed
            const apiKey = this.getApiKey();
            const channelId = await this.resolveChannelId(input.channelIdentifier, apiKey);
            // Step 2: Get channel details and statistics
            const channelData = await this.getChannelDetails(channelId, apiKey);
            // Step 3: Get recent videos if requested
            let recentVideos = [];
            if (input.includeRecentVideos) {
                recentVideos = await this.getRecentVideos(channelId, input.maxVideos || 10, apiKey);
            }
            // Step 4: Calculate analytics
            const analytics = this.calculateAnalytics(channelData, recentVideos);
            return {
                channel: channelData,
                recentVideos: input.includeRecentVideos ? recentVideos : undefined,
                analytics
            };
        }
        catch (error) {
            throw new Error(`Channel analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async resolveChannelId(identifier, apiKey) {
        // If it's already a channel ID (starts with UC and is 24 characters)
        if (identifier.startsWith('UC') && identifier.length === 24) {
            return identifier;
        }
        // If it's a URL, extract the channel ID or username
        if (identifier.includes('youtube.com/')) {
            const url = new URL(identifier);
            const pathname = url.pathname;
            if (pathname.includes('/channel/')) {
                return pathname.split('/channel/')[1].split('/')[0];
            }
            else if (pathname.includes('/@')) {
                identifier = '@' + pathname.split('/@')[1].split('/')[0];
            }
            else if (pathname.includes('/c/') || pathname.includes('/user/')) {
                identifier = pathname.split('/').pop() || identifier;
            }
        }
        // If it's a username starting with @, search for the channel
        if (identifier.startsWith('@')) {
            return await this.searchChannelByUsername(identifier, apiKey);
        }
        // Try to search by username
        return await this.searchChannelByUsername(identifier, apiKey);
    }
    async searchChannelByUsername(username, apiKey) {
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
        searchUrl.searchParams.append('part', 'snippet');
        searchUrl.searchParams.append('q', username);
        searchUrl.searchParams.append('type', 'channel');
        searchUrl.searchParams.append('maxResults', '1');
        searchUrl.searchParams.append('key', apiKey);
        const response = await fetch(searchUrl.toString());
        if (!response.ok) {
            throw new Error(`Failed to search for channel: ${response.status}`);
        }
        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            throw new Error(`Channel not found: ${username}`);
        }
        return data.items[0].id.channelId;
    }
    async getChannelDetails(channelId, apiKey) {
        const url = new URL('https://www.googleapis.com/youtube/v3/channels');
        url.searchParams.append('part', 'snippet,statistics,brandingSettings,contentDetails');
        url.searchParams.append('id', channelId);
        url.searchParams.append('key', apiKey);
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Failed to fetch channel details: ${response.status}`);
        }
        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            throw new Error('Channel not found');
        }
        const item = data.items[0];
        return {
            channelId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            customUrl: item.snippet.customUrl,
            publishedAt: item.snippet.publishedAt,
            thumbnails: {
                default: item.snippet.thumbnails?.default?.url,
                medium: item.snippet.thumbnails?.medium?.url,
                high: item.snippet.thumbnails?.high?.url
            },
            statistics: {
                viewCount: item.statistics.viewCount,
                subscriberCount: item.statistics.subscriberCount,
                hiddenSubscriberCount: item.statistics.hiddenSubscriberCount || false,
                videoCount: item.statistics.videoCount
            },
            brandingSettings: item.brandingSettings,
            contentDetails: item.contentDetails
        };
    }
    async getRecentVideos(channelId, maxResults, apiKey) {
        // First, get the uploads playlist ID
        const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
        channelUrl.searchParams.append('part', 'contentDetails');
        channelUrl.searchParams.append('id', channelId);
        channelUrl.searchParams.append('key', apiKey);
        const channelResponse = await fetch(channelUrl.toString());
        const channelData = await channelResponse.json();
        const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!uploadsPlaylistId) {
            return [];
        }
        // Get videos from uploads playlist
        const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
        playlistUrl.searchParams.append('part', 'snippet');
        playlistUrl.searchParams.append('playlistId', uploadsPlaylistId);
        playlistUrl.searchParams.append('maxResults', maxResults.toString());
        playlistUrl.searchParams.append('key', apiKey);
        const playlistResponse = await fetch(playlistUrl.toString());
        const playlistData = await playlistResponse.json();
        if (!playlistData.items) {
            return [];
        }
        // Get detailed video information
        const videoIds = playlistData.items.map((item) => item.snippet.resourceId.videoId).join(',');
        const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        videosUrl.searchParams.append('part', 'snippet,statistics,contentDetails');
        videosUrl.searchParams.append('id', videoIds);
        videosUrl.searchParams.append('key', apiKey);
        const videosResponse = await fetch(videosUrl.toString());
        const videosData = await videosResponse.json();
        return videosData.items.map((item) => ({
            videoId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            thumbnails: {
                default: item.snippet.thumbnails?.default?.url,
                medium: item.snippet.thumbnails?.medium?.url,
                high: item.snippet.thumbnails?.high?.url
            },
            statistics: {
                viewCount: item.statistics.viewCount,
                likeCount: item.statistics.likeCount,
                commentCount: item.statistics.commentCount
            },
            duration: item.contentDetails.duration
        }));
    }
    calculateAnalytics(channelData, recentVideos) {
        const totalViews = parseInt(channelData.statistics.viewCount);
        const totalVideos = parseInt(channelData.statistics.videoCount);
        const totalSubscribers = parseInt(channelData.statistics.subscriberCount);
        const analytics = {
            totalViews,
            averageViewsPerVideo: totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0,
            subscribersPerVideo: totalVideos > 0 ? Math.round(totalSubscribers / totalVideos) : 0
        };
        if (recentVideos.length > 0) {
            // Calculate engagement rate from recent videos
            const totalRecentViews = recentVideos.reduce((sum, video) => {
                return sum + (parseInt(video.statistics.viewCount || '0'));
            }, 0);
            const totalRecentLikes = recentVideos.reduce((sum, video) => {
                return sum + (parseInt(video.statistics.likeCount || '0'));
            }, 0);
            const totalRecentComments = recentVideos.reduce((sum, video) => {
                return sum + (parseInt(video.statistics.commentCount || '0'));
            }, 0);
            if (totalRecentViews > 0) {
                analytics.engagementRate = parseFloat((((totalRecentLikes + totalRecentComments) / totalRecentViews) * 100).toFixed(2));
            }
            // Calculate videos per month based on recent videos
            const oldestVideo = new Date(Math.min(...recentVideos.map(v => new Date(v.publishedAt).getTime())));
            const newestVideo = new Date(Math.max(...recentVideos.map(v => new Date(v.publishedAt).getTime())));
            const monthsDiff = (newestVideo.getTime() - oldestVideo.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsDiff > 0) {
                analytics.videosPerMonth = parseFloat((recentVideos.length / monthsDiff).toFixed(1));
            }
        }
        return analytics;
    }
};
YouTubeChannelAnalysisTool = __decorate([
    Tool({
        name: 'analyze_youtube_channel',
        description: 'Get comprehensive analytics and statistics for a YouTube channel including subscriber count, view count, video count, recent videos, and engagement metrics.',
        inputSchema: {
            channelIdentifier: z.string().describe('Channel ID, channel username (starting with @), or channel URL'),
            includeRecentVideos: z.boolean().default(true).describe('Whether to include recent videos analysis'),
            maxVideos: z.number().min(1).max(50).default(10).describe('Maximum number of recent videos to analyze')
        },
        outputSchema: {
            channel: ChannelStatisticsSchema,
            recentVideos: z.array(RecentVideosSchema).optional(),
            analytics: z.object({
                averageViewsPerVideo: z.number().optional(),
                totalViews: z.number(),
                engagementRate: z.number().optional(),
                videosPerMonth: z.number().optional(),
                subscribersPerVideo: z.number().optional()
            })
        }
    })
], YouTubeChannelAnalysisTool);
export default YouTubeChannelAnalysisTool;
//# sourceMappingURL=youtube-channel-analysis.tool.js.map