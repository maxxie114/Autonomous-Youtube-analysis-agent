import { App } from '@frontmcp/sdk';
import YouTubeSearchTool from './tools/youtube-search.tool';
import YouTubeChannelAnalysisTool from './tools/youtube-channel-analysis.tool';

@App({
    id: 'youtube',
    name: 'YouTube Search',
    tools: [YouTubeSearchTool, YouTubeChannelAnalysisTool],
})
export class YouTubeApp { }
