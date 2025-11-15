import { App } from '@frontmcp/sdk';
import YouTubeSearchTool from './tools/youtube-search.tool';
import YouTubeChannelAnalysisTool from './tools/youtube-channel-analysis.tool';
import YouTubeVideoAnalysisTool from './tools/youtube-video-analysis.tool';

@App({
    id: 'youtube',
    name: 'YouTube Analytics Suite',
    tools: [YouTubeSearchTool, YouTubeChannelAnalysisTool, YouTubeVideoAnalysisTool],
})
export class YouTubeApp { }
