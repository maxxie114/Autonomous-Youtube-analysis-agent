var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { App } from '@frontmcp/sdk';
import ThumbnailGeneratorTool from './tools/thumbnail-generator.tool';
import YouTubeChannelAnalysisTool from './tools/youtube-channel-analysis.tool';
import YouTubeSearchTool from './tools/youtube-search.tool';
import YouTubeUploadTool from './tools/youtube-upload.tool';
import YouTubeVideoAnalysisTool from './tools/youtube-video-analysis.tool';
let YouTubeApp = class YouTubeApp {
};
YouTubeApp = __decorate([
    App({
        id: 'youtube',
        name: 'YouTube Tools',
        tools: [YouTubeSearchTool, YouTubeUploadTool, ThumbnailGeneratorTool, YouTubeChannelAnalysisTool, YouTubeVideoAnalysisTool],
    })
], YouTubeApp);
export { YouTubeApp };
//# sourceMappingURL=youtube.app.js.map