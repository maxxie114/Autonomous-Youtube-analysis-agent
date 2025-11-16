var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { FrontMcp } from '@frontmcp/sdk';
import 'dotenv/config';
import 'reflect-metadata';
import { YouTubeApp } from './youtube.app';
let Server = class Server {
};
Server = __decorate([
    FrontMcp({
        info: { name: 'Youtube-agent 🚀', version: '0.1.0' },
        apps: [YouTubeApp],
    })
], Server);
export default Server;
//# sourceMappingURL=main.js.map