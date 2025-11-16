var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Tool, ToolContext } from '@frontmcp/sdk';
import { z } from 'zod';
let YouTubeSearchTool = class YouTubeSearchTool extends ToolContext {
    parseSubFilter(subscribers) {
        if (!subscribers)
            return {};
        const filter = {};
        const lessThan = subscribers.match(/(?:less than|under|below)\s+(\d+(?:\.\d+)?)\s*([kmb])?/i);
        if (lessThan) {
            filter.max = this.toNumber(parseFloat(lessThan[1]), lessThan[2]);
        }
        const moreThan = subscribers.match(/(?:more than|over|above)\s+(\d+(?:\.\d+)?)\s*([kmb])?/i);
        if (moreThan) {
            filter.min = this.toNumber(parseFloat(moreThan[1]), moreThan[2]);
        }
        const between = subscribers.match(/between\s+(\d+(?:\.\d+)?)\s*([kmb])?\s+and\s+(\d+(?:\.\d+)?)\s*([kmb])?/i);
        if (between) {
            filter.min = this.toNumber(parseFloat(between[1]), between[2]);
            filter.max = this.toNumber(parseFloat(between[3]), between[4]);
        }
        return filter;
    }
    toNumber(val, unit) {
        if (!unit)
            return val;
        const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
        return val * (multipliers[unit.toLowerCase()] || 1);
    }
    formatSubs(count) {
        if (count >= 1000000)
            return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000)
            return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    }
    async execute(input) {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey)
            throw new Error('YOUTUBE_API_KEY not set');
        const subFilter = this.parseSubFilter(input.subscribers);
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.append('part', 'snippet');
        url.searchParams.append('q', input.category);
        url.searchParams.append('type', 'channel');
        url.searchParams.append('maxResults', '50');
        if (input.location)
            url.searchParams.append('regionCode', input.location.toUpperCase());
        url.searchParams.append('key', apiKey);
        const res = await fetch(url.toString());
        if (!res.ok)
            throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json();
        const channelIds = data.items?.map((item) => item.id.channelId) || [];
        if (channelIds.length === 0)
            return { results: [] };
        const statsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
        statsUrl.searchParams.append('part', 'statistics,snippet');
        statsUrl.searchParams.append('id', channelIds.join(','));
        statsUrl.searchParams.append('key', apiKey);
        const statsRes = await fetch(statsUrl.toString());
        if (!statsRes.ok)
            throw new Error(`YouTube API error: ${statsRes.status}`);
        const statsData = await statsRes.json();
        let results = statsData.items?.map((item) => ({
            channelId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            iconUrl: item.snippet.thumbnails?.default?.url || '',
            subscriberCount: this.formatSubs(parseInt(item.statistics?.subscriberCount || '0')),
            _raw: parseInt(item.statistics?.subscriberCount || '0')
        })) || [];
        if (subFilter.min)
            results = results.filter((r) => r._raw >= subFilter.min);
        if (subFilter.max)
            results = results.filter((r) => r._raw <= subFilter.max);
        return { results: results.slice(0, 10).map(({ _raw, ...r }) => r) };
    }
};
YouTubeSearchTool = __decorate([
    Tool({
        name: 'search_youtube_channels',
        description: 'Search for YouTube channels by category with subscriber count and location filters. Returns channels with details.',
        inputSchema: {
            category: z.string().describe('Channel category/topic (e.g., "gaming", "cooking", "tech")'),
            subscribers: z.string().optional().describe('Subscriber filter in natural language (e.g., "less than 1m", "more than 500k", "between 100k and 1m")'),
            location: z.string().optional().describe('Location/region code (e.g., "US", "JP", "GB")')
        },
        outputSchema: {
            results: z.array(z.object({
                channelId: z.string(),
                title: z.string(),
                description: z.string(),
                iconUrl: z.string(),
                subscriberCount: z.string()
            }))
        }
    })
], YouTubeSearchTool);
export default YouTubeSearchTool;
//# sourceMappingURL=youtube-search.tool.js.map