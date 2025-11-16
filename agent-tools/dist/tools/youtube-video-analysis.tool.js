var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let YouTubeVideoAnalysisTool = class YouTubeVideoAnalysisTool extends ToolContext {
    getApiKey() {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            throw new Error('YOUTUBE_API_KEY environment variable is not set');
        }
        return apiKey;
    }
    async execute(input) {
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
                transcriptData = await this.getVideoTranscript(videoId, input.transcriptLanguage || 'en');
            }
            // Step 5: Build comprehensive video object
            const video = this.buildVideoObject(videoData, channelData, transcriptData);
            // Step 6: Calculate analytics
            const analytics = this.calculateVideoAnalytics(video);
            return {
                video,
                analytics
            };
        }
        catch (error) {
            throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    extractVideoId(identifier) {
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
    async getVideoDetails(videoId, apiKey) {
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
    async getChannelBasicInfo(channelId, apiKey) {
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
    async getVideoTranscript(videoId, language) {
        try {
            console.log(`Fetching transcript for video ${videoId} with language ${language}`);
            // Dynamically import Innertube (ES module)
            const { Innertube } = await import('youtubei.js');
            // Initialize Innertube
            const youtube = await Innertube.create();
            // Get video info
            const info = await youtube.getInfo(videoId);
            // Get transcript
            const transcriptData = await info.getTranscript();
            if (!transcriptData || !transcriptData.transcript) {
                console.log('No transcript available for this video');
                return {
                    available: false,
                    language: null,
                    text: null,
                    segments: null
                };
            }
            // Extract segments
            const content = transcriptData.transcript.content;
            if (!content || !content.body) {
                console.log('Transcript content is empty');
                return {
                    available: false,
                    language: null,
                    text: null,
                    segments: null
                };
            }
            // Parse segments
            const segments = [];
            let fullText = '';
            for (const item of content.body.initial_segments) {
                if (item.snippet) {
                    const text = item.snippet.text || '';
                    const startMs = Number(item.start_ms) || 0;
                    const endMs = Number(item.end_ms) || 0;
                    const durationMs = endMs > 0 ? endMs - startMs : 0;
                    segments.push({
                        start: startMs / 1000,
                        duration: durationMs / 1000,
                        text: text
                    });
                    fullText += text + ' ';
                }
            }
            fullText = fullText.trim();
            if (segments.length === 0) {
                console.log('No transcript segments parsed');
                return {
                    available: false,
                    language: null,
                    text: null,
                    segments: null
                };
            }
            console.log(`Transcript successfully fetched: ${segments.length} segments, ${fullText.length} characters`);
            return {
                available: true,
                language: language,
                text: fullText,
                segments: segments
            };
        }
        catch (error) {
            console.log(`Error fetching transcript:`, error);
            return {
                available: false,
                language: null,
                text: null,
                segments: null
            };
        }
    }
    buildVideoObject(videoData, channelData, transcriptData) {
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
    calculateVideoAnalytics(video) {
        const views = parseInt(video.statistics.viewCount);
        const likes = parseInt(video.statistics.likeCount || '0');
        const comments = parseInt(video.statistics.commentCount || '0');
        // Parse duration (PT#M#S format)
        const durationMinutes = this.parseDurationToMinutes(video.duration);
        // Calculate days since published
        const publishedDate = new Date(video.publishedAt);
        const now = new Date();
        const daysSincePublished = Math.max(1, Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)));
        const analytics = {
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
        if (video.transcript?.text && video.transcript.available) {
            const wordCount = video.transcript.text.split(/\s+/).length;
            analytics.transcriptWordCount = wordCount;
            analytics.avgWordsPerMinute = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;
        }
        return analytics;
    }
    parseDurationToMinutes(duration) {
        // Parse ISO 8601 duration (PT#H#M#S)
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match)
            return 0;
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');
        return hours * 60 + minutes + seconds / 60;
    }
};
YouTubeVideoAnalysisTool = __decorate([
    Tool({
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
], YouTubeVideoAnalysisTool);
export default YouTubeVideoAnalysisTool;
//# sourceMappingURL=youtube-video-analysis.tool.js.map