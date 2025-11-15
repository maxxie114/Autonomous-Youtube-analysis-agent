import { Tool, ToolContext } from '@frontmcp/sdk';
import { z } from 'zod';

const VideoDetailsSchema = z.object({
    videoId: z.string(),
    title: z.string(),
    description: z.string(),
    publishedAt: z.string(),
    duration: z.string(),
    thumbnails: z.object({
        default: z.string().optional(),
        medium: z.string().optional(),
        high: z.string().optional(),
        maxres: z.string().optional()
    }).optional(),
    statistics: z.object({
        viewCount: z.string(),
        likeCount: z.string().optional(),
        commentCount: z.string().optional()
    }),
    channel: z.object({
        channelId: z.string(),
        title: z.string(),
        subscriberCount: z.string().optional()
    }),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    defaultLanguage: z.string().optional(),
    transcript: z.object({
        available: z.boolean(),
        language: z.string().nullable(),
        text: z.string().nullable(),
        segments: z.array(z.object({
            start: z.number(),
            duration: z.number(),
            text: z.string()
        })).nullable()
    }).optional()
});

const VideoAnalyticsSchema = z.object({
    engagementRate: z.number().optional(),
    commentsPerView: z.number().optional(),
    likesPerView: z.number().optional(),
    viewsPerDay: z.number().optional(),
    avgWordsPerMinute: z.number().optional(),
    transcriptWordCount: z.number().optional(),
    videoDurationMinutes: z.number()
});

@Tool({
    name: 'analyze_youtube_video',
    description: 'Get comprehensive analytics and details for a YouTube video including statistics, transcript, engagement metrics, and content analysis.',
    inputSchema: { 
        videoIdentifier: z.string().describe('YouTube video URL or video ID'),
        includeTranscript: z.boolean().default(true).describe('Whether to fetch video transcript'),
        transcriptLanguage: z.string().default('en').describe('Preferred transcript language (e.g., en, es, fr)')
    },
    outputSchema: {
        video: VideoDetailsSchema,
        analytics: VideoAnalyticsSchema
    }
})
export default class YouTubeVideoAnalysisTool extends ToolContext {
    private getApiKey(): string {
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            throw new Error('YOUTUBE_API_KEY environment variable is not set');
        }

        return apiKey;
    }

    async execute(input: { videoIdentifier: string; includeTranscript?: boolean; transcriptLanguage?: string }) {
        try {
            const apiKey = this.getApiKey();
            
            // Step 1: Extract video ID from URL or use directly
            const videoId = this.extractVideoId(input.videoIdentifier);
            
            // Step 2: Get video details and statistics
            const videoData = await this.getVideoDetails(videoId, apiKey);
            
            // Step 3: Get channel info for the video
            const channelData = await this.getChannelBasicInfo(videoData.snippet.channelId, apiKey);
            
            // Step 4: Get transcript if requested
            let transcriptData = null;
            if (input.includeTranscript) {
                transcriptData = await this.getVideoTranscript(videoId, input.transcriptLanguage || 'en', apiKey);
            }
            
            // Step 5: Build comprehensive video object
            const video = this.buildVideoObject(videoData, channelData, transcriptData);
            
            // Step 6: Calculate analytics
            const analytics = this.calculateVideoAnalytics(video);
            
            return {
                video,
                analytics
            };
        } catch (error) {
            throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private extractVideoId(identifier: string): string {
        // If it's already a video ID (11 characters)
        if (identifier.length === 11 && !identifier.includes('/')) {
            return identifier;
        }

        // Extract from various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = identifier.match(pattern);
            if (match) {
                return match[1];
            }
        }

        throw new Error(`Invalid YouTube video URL or ID: ${identifier}`);
    }

    private async getVideoDetails(videoId: string, apiKey: string) {
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.append('part', 'snippet,statistics,contentDetails');
        url.searchParams.append('id', videoId);
        url.searchParams.append('key', apiKey);

        const response = await fetch(url.toString());
        
        if (!response.ok) {
            throw new Error(`Failed to fetch video details: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            throw new Error('Video not found or is private');
        }

        return data.items[0];
    }

    private async getChannelBasicInfo(channelId: string, apiKey: string) {
        const url = new URL('https://www.googleapis.com/youtube/v3/channels');
        url.searchParams.append('part', 'snippet,statistics');
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

        return data.items[0];
    }

    private async getVideoTranscript(videoId: string, language: string, apiKey: string) {
        try {
            // First, check if captions are available
            const captionsUrl = new URL('https://www.googleapis.com/youtube/v3/captions');
            captionsUrl.searchParams.append('part', 'snippet');
            captionsUrl.searchParams.append('videoId', videoId);
            captionsUrl.searchParams.append('key', apiKey);

            const captionsResponse = await fetch(captionsUrl.toString());
            
            if (!captionsResponse.ok) {
                return {
                    available: false,
                    language: null,
                    text: null,
                    segments: null
                };
            }

            const captionsData = await captionsResponse.json();
            
            if (!captionsData.items || captionsData.items.length === 0) {
                return {
                    available: false,
                    language: null,
                    text: null,
                    segments: null
                };
            }

            // Find caption track in requested language or fallback to first available
            let captionTrack = captionsData.items.find((item: any) => 
                item.snippet.language === language
            );
            
            if (!captionTrack) {
                captionTrack = captionsData.items[0]; // Use first available
            }

            // Note: YouTube API doesn't allow downloading caption content directly
            // This would require additional authentication or third-party services
            // For now, we'll return metadata about transcript availability
            return {
                available: true,
                language: captionTrack.snippet.language,
                text: "Transcript download requires additional authentication. Caption track available.",
                segments: null
            };

        } catch (error) {
            return {
                available: false,
                language: null,
                text: null,
                segments: null
            };
        }
    }

    private buildVideoObject(videoData: any, channelData: any, transcriptData: any) {
        return {
            videoId: videoData.id,
            title: videoData.snippet.title,
            description: videoData.snippet.description,
            publishedAt: videoData.snippet.publishedAt,
            duration: videoData.contentDetails.duration,
            thumbnails: {
                default: videoData.snippet.thumbnails?.default?.url,
                medium: videoData.snippet.thumbnails?.medium?.url,
                high: videoData.snippet.thumbnails?.high?.url,
                maxres: videoData.snippet.thumbnails?.maxres?.url
            },
            statistics: {
                viewCount: videoData.statistics.viewCount,
                likeCount: videoData.statistics.likeCount,
                commentCount: videoData.statistics.commentCount
            },
            channel: {
                channelId: videoData.snippet.channelId,
                title: videoData.snippet.channelTitle,
                subscriberCount: channelData.statistics.subscriberCount
            },
            tags: videoData.snippet.tags || [],
            category: videoData.snippet.categoryId,
            defaultLanguage: videoData.snippet.defaultLanguage,
            transcript: transcriptData
        };
    }

    private calculateVideoAnalytics(video: any) {
        const views = parseInt(video.statistics.viewCount);
        const likes = parseInt(video.statistics.likeCount || '0');
        const comments = parseInt(video.statistics.commentCount || '0');
        
        // Parse duration (PT#M#S format)
        const durationMinutes = this.parseDurationToMinutes(video.duration);
        
        // Calculate days since published
        const publishedDate = new Date(video.publishedAt);
        const now = new Date();
        const daysSincePublished = Math.max(1, Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)));

        const analytics: any = {
            videoDurationMinutes: durationMinutes,
            likesPerView: views > 0 ? parseFloat((likes / views * 100).toFixed(4)) : 0,
            commentsPerView: views > 0 ? parseFloat((comments / views * 100).toFixed(4)) : 0,
            viewsPerDay: Math.round(views / daysSincePublished)
        };

        // Overall engagement rate (likes + comments / views)
        if (views > 0) {
            analytics.engagementRate = parseFloat(((likes + comments) / views * 100).toFixed(2));
        }

        // Transcript analytics
        if (video.transcript?.text && video.transcript.text !== "Transcript download requires additional authentication. Caption track available.") {
            const wordCount = video.transcript.text.split(/\s+/).length;
            analytics.transcriptWordCount = wordCount;
            analytics.avgWordsPerMinute = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;
        }

        return analytics;
    }

    private parseDurationToMinutes(duration: string): number {
        // Parse ISO 8601 duration (PT#H#M#S)
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');
        
        return hours * 60 + minutes + seconds / 60;
    }
}