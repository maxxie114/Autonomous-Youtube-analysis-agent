import { Tool, ToolContext } from '@frontmcp/sdk';
import { z } from 'zod';

@Tool({
    name: 'search_youtube_channels',
    description: 'Search for channels on YouTube by title, description, and content. Returns up to 5 relevant channels.',
    inputSchema: { query: z.string().describe('Search query for YouTube channels (e.g., "gaming", "cooking", "tech reviews")') },
    outputSchema: {
        results: z.array(z.object({
            channelId: z.string(),
            title: z.string(),
            description: z.string(),
            thumbnailUrl: z.string().optional(),
            subscriberCount: z.string().optional()
        }))
    }
})
export default class YouTubeSearchTool extends ToolContext {
    async execute(input: { query: string }) {
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            throw new Error('YOUTUBE_API_KEY environment variable is not set');
        }

        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.append('part', 'snippet');
        url.searchParams.append('q', input.query);
        url.searchParams.append('type', 'channel');
        url.searchParams.append('maxResults', '5');
        url.searchParams.append('key', apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`YouTube API error: ${response.status} - ${error}`);
        }

        const data = await response.json();

        const results = data.items?.map((item: any) => ({
            channelId: item.id.channelId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails?.default?.url,
        })) || [];

        return { results };
    }
}
