import { FrontMcp } from '@frontmcp/sdk';
import 'dotenv/config';
import 'reflect-metadata';
import { YouTubeApp } from './youtube.app';

@FrontMcp({
  info: { name: 'Youtube-agent 🚀', version: '0.1.0' },
  apps: [YouTubeApp],
  serve: true,
  http: { port: 3001, entryPath: '' } // ← MCP endpoint available here
})
export default class Server { }
