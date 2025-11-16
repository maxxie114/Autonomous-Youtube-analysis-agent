import { Tool, ToolContext } from '@frontmcp/sdk';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { z } from 'zod';

@Tool({
    name: 'upload_youtube_video',
    description: 'Upload an MP4 video file to YouTube with thumbnail. Supports both local file paths and URLs for thumbnails.',
    inputSchema: {
        videoFile: z.string().describe('Path to the MP4 video file (e.g., /path/to/video.mp4)'),
        title: z.string().describe('Video title'),
        description: z.string().optional().describe('Video description'),
        thumbnailFile: z.string().describe('Path to the thumbnail image (JPG or PNG) or URL to thumbnail'),
        privacyStatus: z.enum(['public', 'private', 'unlisted']).optional().describe('Privacy: public, private, or unlisted (default: public)')
    },
    outputSchema: {
        videoId: z.string(),
        url: z.string(),
        privacyStatus: z.string()
    }
})
export default class YouTubeUploadTool extends ToolContext {
    private readonly TOKEN_FILE = path.join(process.cwd(), 'youtube-token.json');
    private readonly CLIENT_SECRET_FILE = path.join(process.cwd(), 'client_secret.json');

    private async getCredentials(): Promise<{ access_token: string }> {
        if (fs.existsSync(this.TOKEN_FILE)) {
            const tokenData = JSON.parse(fs.readFileSync(this.TOKEN_FILE, 'utf-8'));

            if (tokenData.access_token && tokenData.expiry && Date.now() < tokenData.expiry) {
                return tokenData;
            }

            if (tokenData.refresh_token) {
                try {
                    const refreshed = await this.refreshToken(tokenData.refresh_token);
                    this.saveToken(refreshed);
                    return refreshed;
                } catch (error) {
                    console.log('Token expired, re-authenticating...');
                }
            }
        }

        return await this.doOAuthFlow();
    }

    private async refreshToken(refreshToken: string): Promise<any> {
        const config = JSON.parse(fs.readFileSync(this.CLIENT_SECRET_FILE, 'utf-8'));
        const { client_id, client_secret } = config.web;

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id,
                client_secret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) throw new Error('Token refresh failed');

        const data = await response.json();
        return {
            access_token: data.access_token,
            refresh_token: refreshToken,
            expiry: Date.now() + (data.expires_in * 1000)
        };
    }

    private async doOAuthFlow(): Promise<any> {
        const config = JSON.parse(fs.readFileSync(this.CLIENT_SECRET_FILE, 'utf-8'));
        const { client_id, client_secret } = config.web;
        const redirect_uri = process.env.OAUTH_REDIRECT_URL
            ? `${process.env.OAUTH_REDIRECT_URL}/oauth2callback`
            : 'http://localhost:3001/oauth2callback';

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${client_id}&` +
            `redirect_uri=${encodeURIComponent(redirect_uri)}&` +
            `response_type=code&` +
            `scope=https://www.googleapis.com/auth/youtube.upload&` +
            `access_type=offline&` +
            `prompt=consent`;

        console.log('\n🔐 Open this URL to authorize:\n');
        console.log(authUrl + '\n');

        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                const url = new URL(req.url!, `http://${req.headers.host}`);

                if (url.pathname === '/oauth2callback') {
                    const code = url.searchParams.get('code');
                    if (!code) {
                        res.end('<h1>Error: No code</h1>');
                        server.close();
                        reject(new Error('No authorization code'));
                        return;
                    }

                    try {
                        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                code,
                                client_id,
                                client_secret,
                                redirect_uri,
                                grant_type: 'authorization_code'
                            })
                        });

                        const tokens = await tokenResponse.json();
                        if (tokens.error) throw new Error(tokens.error);

                        const credentials = {
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token,
                            expiry: Date.now() + (tokens.expires_in * 1000)
                        };

                        this.saveToken(credentials);
                        res.end('<h1>✅ Success! Close this window.</h1>');
                        server.close();
                        console.log('✅ Authenticated!\n');
                        resolve(credentials);
                    } catch (error: any) {
                        res.end(`<h1>Error: ${error.message}</h1>`);
                        server.close();
                        reject(error);
                    }
                }
            });

            server.listen(8080);
            setTimeout(() => { server.close(); reject(new Error('Timeout')); }, 300000);
        });
    }

    private saveToken(credentials: any): void {
        fs.writeFileSync(this.TOKEN_FILE, JSON.stringify(credentials, null, 2));
    }

    async execute(input: {
        videoFile: string;
        title: string;
        description?: string;
        thumbnailFile: string;
        privacyStatus?: 'public' | 'private' | 'unlisted';
    }) {
        // Check video file exists
        if (!fs.existsSync(input.videoFile)) {
            throw new Error(`Video file not found: ${input.videoFile}`);
        }

        // Check if thumbnail is URL or file path
        const isUrl = input.thumbnailFile.startsWith('http://') || input.thumbnailFile.startsWith('https://');
        if (!isUrl && !fs.existsSync(input.thumbnailFile)) {
            throw new Error(`Thumbnail file not found: ${input.thumbnailFile}`);
        }

        console.log('📤 Uploading video...');

        const credentials = await this.getCredentials();
        const videoData = fs.readFileSync(input.videoFile);

        const metadata = {
            snippet: {
                title: input.title,
                description: input.description || ''
            },
            status: {
                privacyStatus: input.privacyStatus || 'public'
            }
        };

        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartBody = Buffer.concat([
            Buffer.from(delimiter),
            Buffer.from('Content-Type: application/json\r\n\r\n'),
            Buffer.from(JSON.stringify(metadata)),
            Buffer.from(delimiter),
            Buffer.from('Content-Type: video/mp4\r\n\r\n'),
            videoData,
            Buffer.from(closeDelimiter)
        ]);

        const response = await fetch(
            'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${credentials.access_token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} - ${await response.text()}`);
        }

        const result = await response.json();
        const videoId = result.id;

        console.log('✅ Video uploaded!');
        console.log('🖼️  Uploading thumbnail...');

        // Get thumbnail data (from file or URL)
        let thumbnailData: Buffer;
        let thumbnailType: string;

        if (isUrl) {
            console.log(`📥 Downloading thumbnail from URL...`);
            const imgResponse = await fetch(input.thumbnailFile);
            if (!imgResponse.ok) {
                throw new Error(`Failed to download thumbnail: ${imgResponse.status}`);
            }
            thumbnailData = Buffer.from(await imgResponse.arrayBuffer());

            // Determine type from URL or content-type
            const contentType = imgResponse.headers.get('content-type');
            thumbnailType = contentType === 'image/png' ? 'image/png' : 'image/jpeg';
        } else {
            thumbnailData = fs.readFileSync(input.thumbnailFile);
            const thumbnailExt = path.extname(input.thumbnailFile).toLowerCase();
            thumbnailType = thumbnailExt === '.png' ? 'image/png' : 'image/jpeg';
        }

        const thumbnailResponse = await fetch(
            `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${credentials.access_token}`,
                    'Content-Type': thumbnailType,
                    'Content-Length': thumbnailData.length.toString()
                },
                body: thumbnailData as any
            }
        );

        if (!thumbnailResponse.ok) {
            const errorText = await thumbnailResponse.text();
            console.log(`⚠️  Thumbnail upload failed: ${thumbnailResponse.status}`);
            console.log(`   Error details: ${errorText}`);
            console.log(`   Thumbnail type: ${thumbnailType}`);
            console.log(`   Thumbnail size: ${thumbnailData.length} bytes`);
            console.log('   Video is uploaded successfully though!');
        } else {
            const thumbResult = await thumbnailResponse.json();
            console.log('✅ Thumbnail uploaded!');
            console.log(`   Thumbnail details:`, thumbResult);
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('🎉 Complete!');
        console.log(`📺 ${videoUrl}\n`);

        return {
            videoId,
            url: videoUrl,
            privacyStatus: result.status.privacyStatus
        };
    }
}
