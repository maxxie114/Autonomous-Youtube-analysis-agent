import { App } from '@frontmcp/sdk';
import ImageGeneratorTool from './tools/image-generator.tool';
import ThumbnailGeneratorTool from './tools/thumbnail-generator.tool';
import YouTubeChannelAnalysisTool from './tools/youtube-channel-analysis.tool';
import YouTubeSearchTool from './tools/youtube-search.tool';
import YouTubeUploadTool from './tools/youtube-upload.tool';
import YouTubeVideoAnalysisTool from './tools/youtube-video-analysis.tool';

@App({
    id: 'youtube',
    name: 'YouTube Tools',
    tools: [YouTubeSearchTool, YouTubeUploadTool, ThumbnailGeneratorTool, YouTubeChannelAnalysisTool, YouTubeVideoAnalysisTool, ImageGeneratorTool],
})
export class YouTubeApp { }
